"""
AIDC Identifier Generation Service
GTIN bulk generation, GS1 Digital Link builder, UUIDv4/UUIDv7, and Company Prefix sequencing.
"""
import uuid
import time
import os
import secrets
from typing import List, Optional
from ..schemas import IdentifierItem, IdentifierGenResponse
from .validation_service import ValidationService

class IdentifierService:
    @staticmethod
    def generate_uuidv7() -> str:
        """
        Generates a standard RFC 9562 UUIDv7 (Unix millisecond timestamp + random bits).
        Format: 8-4-4-4-12 hex string with version 7 and variant 2.
        """
        # 48-bit timestamp in milliseconds
        timestamp_ms = int(time.time() * 1000)
        time_hex = f"{timestamp_ms:012x}" # 12 hex digits = 48 bits

        # 74 bits of randomness
        rand_bytes = secrets.token_bytes(10)
        rand_hex = rand_bytes.hex()

        # Construct 32 hex chars:
        # 0-7: time_high (8 hex)
        # 8-11: time_mid (4 hex)
        # 12-15: ver (0x7) + rand_a (12 bits -> 3 hex)
        # 16-19: var (0b10..) (2 bits) + rand_b (14 bits -> 4 hex)
        # 20-31: rand_c (48 bits -> 12 hex)
        part1 = time_hex[0:8]
        part2 = time_hex[8:12]
        part3 = "7" + rand_hex[0:3]
        
        # Variant bits: top 2 bits must be '10' -> 8, 9, a, or b
        variant_nibble = hex(0x8 | (int(rand_hex[3], 16) & 0x3))[2:]
        part4 = variant_nibble + rand_hex[4:7]
        part5 = rand_hex[7:19]

        return f"{part1}-{part2}-{part3}-{part4}-{part5}"

    @classmethod
    def generate_identifiers(
        cls,
        id_type: str,
        prefix: Optional[str] = None,
        item_ref: Optional[str] = None,
        quantity: int = 1,
        domain: str = "https://id.gs1.org",
        lot: Optional[str] = None,
        expiry: Optional[str] = None,
        serial: Optional[str] = None
    ) -> IdentifierGenResponse:
        t = id_type.lower().strip()
        items: List[IdentifierItem] = []

        if t in ["uuid", "uuidv4"]:
            for _ in range(quantity):
                val = str(uuid.uuid4())
                items.append(IdentifierItem(
                    payload=val,
                    formatted=val,
                    type="uuidv4"
                ))

        elif t == "uuidv7":
            for _ in range(quantity):
                val = cls.generate_uuidv7()
                items.append(IdentifierItem(
                    payload=val,
                    formatted=val,
                    type="uuidv7"
                ))

        elif t == "guid":
            for _ in range(quantity):
                raw_u = str(uuid.uuid4()).upper()
                items.append(IdentifierItem(
                    payload=raw_u,
                    formatted=f"{{{raw_u}}}",
                    type="guid"
                ))

        elif t in ["gtin8", "gtin12", "gtin13", "gtin14"]:
            target_lens = {"gtin8": 8, "gtin12": 12, "gtin13": 13, "gtin14": 14}
            total_len = target_lens[t]
            body_len = total_len - 1

            # Default prefixes if none provided
            base_prefix = prefix or ("0950110" if total_len >= 12 else "890123")
            start_num = int(item_ref) if item_ref and item_ref.isdigit() else 1

            for i in range(quantity):
                curr_num = start_num + i
                combined = f"{base_prefix}{curr_num}"
                if len(combined) < body_len:
                    # Pad with zeroes between prefix and sequence
                    pad_needed = body_len - len(base_prefix)
                    body = f"{base_prefix}{curr_num:0{pad_needed}d}"
                else:
                    body = combined[:body_len]

                check = ValidationService.calculate_mod10_check_digit(body)
                full_gtin = body + check

                # Also generate corresponding GS1 Digital Link
                clean_domain = domain.rstrip('/')
                dl_url = f"{clean_domain}/01/{full_gtin}"

                items.append(IdentifierItem(
                    payload=full_gtin,
                    check_digit=check,
                    formatted=full_gtin,
                    digital_link_url=dl_url,
                    type=t
                ))

        elif t in ["gs1_digital_link", "digital_link"]:
            base_gtin = prefix or "0950110153000"
            if len(base_gtin) < 14 and base_gtin.isdigit():
                # ensure 14 digits with check digit
                check = ValidationService.calculate_mod10_check_digit(base_gtin)
                base_gtin = (base_gtin + check).zfill(14)

            clean_domain = domain.rstrip('/')
            start_ser = int(serial) if serial and serial.isdigit() else 1000

            for i in range(quantity):
                curr_ser = start_ser + i
                url = f"{clean_domain}/01/{base_gtin}"
                params = []
                if lot:
                    params.append(f"10={lot}")
                if expiry:
                    params.append(f"17={expiry}")
                params.append(f"21={curr_ser}")
                if params:
                    url += "?" + "&".join(params)

                items.append(IdentifierItem(
                    payload=url,
                    formatted=url,
                    digital_link_url=url,
                    type="gs1_digital_link"
                ))

        return IdentifierGenResponse(
            type=t,
            count=len(items),
            identifiers=items
        )

