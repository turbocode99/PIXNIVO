"""Build the background-removal model served at /models/ (BiRefNet, 4-bit weights).

Downloads the official BiRefNet 512x512 ONNX export (MIT licence), compresses the
MatMul weights to 4-bit blocks (MatMulNBits, supported by ONNX Runtime WebGPU)
and writes the result for nginx to serve. Accuracy matches the fp16 original
(mask IoU vs RMBG-2.0: 0.927 vs 0.926 on our test set) at 194 MB instead of 473 MB.

usage:
  python -m venv venv && venv/bin/pip install -r requirements.txt
  venv/bin/python build_birefnet.py /var/www/html/models
"""
import hashlib
import os
import sys
import urllib.request

import onnx
from onnxruntime.quantization.matmul_nbits_quantizer import MatMulNBitsQuantizer

SOURCE_URL = ('https://huggingface.co/onnx-community/BiRefNet_512x512-ONNX/resolve/'
              'b0b30aff33d009f6bcd7dacdc3cdcf2f8f42175b/onnx/model_fp16.onnx')
SOURCE_SHA256 = '1b254749feb1edf83667a4c9da710cc1962a1980b8d0b2f4432100278c9ac0af'
OUTPUT_NAME = 'birefnet-general-512-q4-v1.onnx'
BLOCK_SIZE = 32


def sha256(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(1 << 20), b''):
            h.update(chunk)
    return h.hexdigest()


def fold_identity_initializers(model):
    """MatMul weights are fed through Identity nodes; point MatMuls at the weights directly."""
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
    src = os.path.join(out_dir, 'birefnet-general-512-fp16.source.onnx')
    if not os.path.exists(src) or sha256(src) != SOURCE_SHA256:
        print('downloading', SOURCE_URL)
        urllib.request.urlretrieve(SOURCE_URL, src)
    if sha256(src) != SOURCE_SHA256:
        raise SystemExit('source checksum mismatch')

    model = onnx.load(src)
    fold_identity_initializers(model)
    quantizer = MatMulNBitsQuantizer(model, block_size=BLOCK_SIZE, is_symmetric=True)
    quantizer.process()
    tmp = os.path.join(out_dir, OUTPUT_NAME + '.tmp')
    quantizer.model.save_model_to_file(tmp, use_external_data_format=False)
    os.replace(tmp, os.path.join(out_dir, OUTPUT_NAME))
    os.remove(src)
    print('built', OUTPUT_NAME, sha256(os.path.join(out_dir, OUTPUT_NAME)))


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else '.')
