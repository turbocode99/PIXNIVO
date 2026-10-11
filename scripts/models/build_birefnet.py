"""Build the background-removal model served at /models/ (BiRefNet general, 1024x1024).

BiRefNet (MIT, ZhengPeng7) is the open architecture RMBG-2.0 is built on. Its stock
ONNX exports cannot run in a browser at 1024x1024: the deformable convolutions are
decomposed into int64 index tensors that need several GB, more than a browser can
allocate. This script exports the official weights with every deformable conv
rewritten as one GridSample + 1x1 conv per kernel tap (same sampling rule as
torchvision; max mask difference ~5e-5), which ONNX Runtime WebGPU runs on the GPU.
It then folds the fixed-shape arithmetic into constants, converts activations to
fp16 and stores the MatMul weights as 4-bit blocks of 16 with zero points.

usage:
  python -m venv venv && venv/bin/pip install -r requirements.txt
  venv/bin/python build_birefnet.py <out_dir>
Needs about 8 GB of RAM; the result is checked against the PyTorch model before it
is written. The browser-tested build is published as GitHub release
models-birefnet-1024-q4-v1 (sha256 4b4d28b9e5a8...c387), which the server downloads.
"""
import hashlib
import importlib
import os
import shutil
import sys
import tempfile
import types
import urllib.request

import numpy as np
import onnx
import onnxruntime as ort
import torch
import torch.nn.functional as F
from onnxconverter_common import float16
from onnxruntime.quantization.matmul_nbits_quantizer import MatMulNBitsQuantizer

REVISION = 'e2bf8e4460fc8fa32bba5ea4d94b3233d367b0e4'  # huggingface.co/ZhengPeng7/BiRefNet
SOURCES = {
    'birefnet.py': '208771ae626f653d64128fbf2d6ac9f8e645c5cc5e286258a73ec3322bbfe5ef',
    'BiRefNet_config.py': 'e7b8c2a74f6cea6a59553d517f71d47f2c1d90e670a13416af17c25fe2f3dc52',
    'model.safetensors': '9ab37426bf4de0567af6b5d21b16151357149139362e6e8992021b8ce356a154',
}
SIZE = 1024
QUANT = dict(bits=4, block_size=16, is_symmetric=False)  # IoU 0.998 vs fp32 (8-bit: 0.9998, +80 MB)
OUTPUT_NAME = 'birefnet-general-1024-q4-v1.onnx'


def sha256(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(1 << 20), b''):
            h.update(chunk)
    return h.hexdigest()


def fetch_sources(work):
    for name, digest in SOURCES.items():
        path = os.path.join(work, name)
        if not os.path.exists(path) or sha256(path) != digest:
            url = f'https://huggingface.co/ZhengPeng7/BiRefNet/resolve/{REVISION}/{name}'
            print('downloading', url, flush=True)
            urllib.request.urlretrieve(url, path)
        if sha256(path) != digest:
            raise SystemExit(f'checksum mismatch: {name}')


def _pair(v):
    return tuple(v) if isinstance(v, (tuple, list)) else (v, v)


def deform_conv2d_gs(input, offset, weight, bias=None, stride=(1, 1), padding=(0, 0), dilation=(1, 1), mask=None):
    """torchvision.ops.deform_conv2d as GridSample (bilinear, zeros, align_corners) per tap."""
    _, _, H, W = input.shape
    kh, kw = weight.shape[2:]
    sh, sw = _pair(stride)
    ph, pw = _pair(padding)
    dh, dw = _pair(dilation)
    Ho, Wo = offset.shape[2:]
    base_y = (torch.arange(Ho, dtype=input.dtype) * sh - ph).view(1, Ho, 1)
    base_x = (torch.arange(Wo, dtype=input.dtype) * sw - pw).view(1, 1, Wo)
    ny, nx = 2.0 / max(H - 1, 1), 2.0 / max(W - 1, 1)
    out = None
    for i in range(kh):
        for j in range(kw):
            k = i * kw + j
            py = base_y + i * dh + offset[:, 2 * k]
            px = base_x + j * dw + offset[:, 2 * k + 1]
            grid = torch.stack((px * nx - 1.0, py * ny - 1.0), dim=-1)
            v = F.grid_sample(input, grid, mode='bilinear', padding_mode='zeros', align_corners=True)
            if mask is not None:
                v = v * mask[:, k:k + 1]
            t = F.conv2d(v, weight[:, :, i:i + 1, j:j + 1])
            out = t if out is None else out + t
    if bias is not None:
        out = out + bias.view(1, -1, 1, 1)
    return out


def check_rewrite():
    from torchvision.ops import deform_conv2d
    torch.manual_seed(0)
    for k in (1, 3, 7):
        x, w, b = torch.randn(1, 16, 37, 41), torch.randn(8, 16, k, k) * 0.1, torch.randn(8)
        off, m = torch.randn(1, 2 * k * k, 37, 41) * 6, torch.rand(1, k * k, 37, 41) * 2
        d = (deform_conv2d(x, off, w, b, padding=k // 2, mask=m) - deform_conv2d_gs(x, off, w, b, padding=k // 2, mask=m)).abs().max()
        if d > 1e-3:
            raise SystemExit(f'deformable conv rewrite differs by {d} (kernel {k})')


def load_model(work):
    pkg = types.ModuleType('birefnet_src')  # birefnet.py relatively imports its config
    pkg.__path__ = [work]
    sys.modules['birefnet_src'] = pkg
    mod = importlib.import_module('birefnet_src.birefnet')
    model = mod.BiRefNet(config=mod.BiRefNetConfig(bb_pretrained=False))
    from safetensors.torch import load_file
    model.load_state_dict(load_file(os.path.join(work, 'model.safetensors')))
    mod.deform_conv2d = deform_conv2d_gs
    return model.eval().float()


class FinalMask(torch.nn.Module):
    def __init__(self, m):
        super().__init__()
        self.m = m

    def forward(self, x):
        return self.m(x)[-1]


def fold_identity_initializers(model):
    """Point consumers of Identity(initializer) straight at the initializer."""
    g = model.graph
    inits = {t.name for t in g.initializer}
    outputs = {o.name for o in g.output}
    rename, keep = {}, []
    for n in g.node:
        if n.op_type == 'Identity' and n.input[0] in inits and n.output[0] not in outputs:
            rename[n.output[0]] = n.input[0]
        else:
            keep.append(n)
    for n in keep:
        for i, name in enumerate(n.input):
            if name in rename:
                n.input[i] = rename[name]
    del g.node[:]
    g.node.extend(keep)


def main(out_dir):
    os.makedirs(out_dir, exist_ok=True)
    work = tempfile.mkdtemp(prefix='birefnet-build-')
    try:
        fetch_sources(work)
        check_rewrite()
        model = FinalMask(load_model(work))
        x = torch.randn(1, 3, SIZE, SIZE)
        with torch.no_grad():
            ref = torch.sigmoid(model(x))[0, 0].numpy()
            exported = os.path.join(work, 'fp32.onnx')
            torch.onnx.export(model, (x,), exported, opset_version=17, dynamo=False,
                              input_names=['input_image'], output_names=['output_image'],
                              do_constant_folding=True)
        del model

        # The input size is fixed, so ONNX Runtime's basic (EP-independent) pass folds the
        # traced shape arithmetic into constants. MatMul+Add stays unfused for the quantizer.
        folded = os.path.join(work, 'folded.onnx')
        so = ort.SessionOptions()
        so.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_BASIC
        so.optimized_model_filepath = folded
        ort.InferenceSession(exported, so, providers=['CPUExecutionProvider'], disabled_optimizers=['MatMulAddFusion'])
        os.remove(exported)

        m = float16.convert_float_to_float16(onnx.load(folded), keep_io_types=True)
        fold_identity_initializers(m)
        onnx.shape_inference.infer_shapes(m, check_type=True, strict_mode=True)
        q = MatMulNBitsQuantizer(m, **QUANT)
        q.process()
        tmp = os.path.join(out_dir, OUTPUT_NAME + '.tmp')
        q.model.save_model_to_file(tmp, use_external_data_format=False)
        del m, q

        # The CPU EP has no fp16 GridSample, so verify the fp32 folded graph here; the
        # fp16/4-bit file was checked in the browser (mask IoU 0.998 against PyTorch).
        s = ort.InferenceSession(folded, providers=['CPUExecutionProvider'])
        got = 1 / (1 + np.exp(-s.run(None, {'input_image': x.numpy()})[0][0, 0]))
        if np.abs(got - ref).max() > 1e-2:
            raise SystemExit('exported graph does not match the PyTorch model')
        os.replace(tmp, os.path.join(out_dir, OUTPUT_NAME))
        print('built', OUTPUT_NAME, sha256(os.path.join(out_dir, OUTPUT_NAME)))
    finally:
        shutil.rmtree(work, ignore_errors=True)


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else '.')
