"""
AIDC Studio Validation Engine
GS1 grammar parser, Modulo-10 checksum verifier, and symbology compliance engine.
"""
import re
import datetime
from typing import Dict, Any, List, Optional
from ..schemas import ValidationResponse, GS1Element

class ValidationService:
    # Common GS1 Application Identifiers specification
    # format: (description, min_len, max_len, is_numeric, is_date, has_gtin)
    GS1_AI_SPEC: Dict[str, Dict[str, Any]] = {
        "00": {"desc": "SSCC (Serial Shipping Container Code)", "len": 18, "numeric": True, "check_digit": True},
        "01": {"desc": "Global Trade Item Number (GTIN)", "len": 14, "numeric": True, "check_digit": True},
        "02": {"desc": "GTIN of Contained Items", "len": 14, "numeric": True, "check_digit": True},
        "10": {"desc": "Batch or Lot Number", "min": 1, "max": 20, "numeric": False},
        "11": {"desc": "Production Date (YYMMDD)", "len": 6, "numeric": True, "is_date": True},
        "12": {"desc": "Due Date (YYMMDD)", "len": 6, "numeric": True, "is_date": True},
        "13": {"desc": "Packaging Date (YYMMDD)", "len": 6, "numeric": True, "is_date": True},
        "15": {"desc": "Best Before Date (YYMMDD)", "len": 6, "numeric": True, "is_date": True},
        "17": {"desc": "Expiration Date (YYMMDD)", "len": 6, "numeric": True, "is_date": True},
        "20": {"desc": "Internal Product Variant", "len": 2, "numeric": True},
        "21": {"desc": "Serial Number", "min": 1, "max": 20, "numeric": False},
        "30": {"desc": "Variable Count", "min": 1, "max": 8, "numeric": True},
        "37": {"desc": "Count of Trade Items", "min": 1, "max": 8, "numeric": True},
        "240": {"desc": "Additional Product Identification", "min": 1, "max": 30, "numeric": False},
        "250": {"desc": "Secondary Serial Number", "min": 1, "max": 30, "numeric": False},
        "400": {"desc": "Customer Purchase Order Number", "min": 1, "max": 30, "numeric": False},
        "414": {"desc": "Global Location Number (GLN)", "len": 13, "numeric": True, "check_digit": True},
        "421": {"desc": "Country of Origin", "len": 3, "numeric": True},
    }

    @staticmethod
    def calculate_mod10_check_digit(digits_str: str) -> str:
        """
        GS1 standard Modulo-10 calculation with alternating 3 and 1 weights
        from right to left.
        """
        clean_digits = [int(d) for d in digits_str if d.isdigit()]
        if not clean_digits:
            return "0"
        
        total = 0
        weight = 3
        for digit in reversed(clean_digits):
            total += digit * weight
            weight = 1 if weight == 3 else 3
            
        remainder = total % 10
        check_digit = (10 - remainder) % 10
        return str(check_digit)

    @classmethod
    def validate_gtin(cls, payload: str, expected_len: Optional[int] = None) -> Dict[str, Any]:
        """
        Validates GTIN-8, GTIN-12, GTIN-13, or GTIN-14.
        """
        clean = re.sub(r'[\s\-]', '', payload)
        if not clean.isdigit():
            return {
                "status": "invalid",
                "errors": ["GTIN must only contain numeric digits [0-9]."],
                "clean": clean
            }

        length = len(clean)
        valid_lengths = [8, 12, 13, 14]
        if expected_len:
            target_lens = [expected_len]
        else:
            target_lens = valid_lengths

        # Case 1: Payload is missing check digit (length = target - 1)
        for t_len in target_lens:
            if length == t_len - 1:
                suggested_check = cls.calculate_mod10_check_digit(clean)
                full_payload = clean + suggested_check
                return {
                    "status": "warning",
                    "warnings": [f"Missing check digit for GTIN-{t_len}. Auto-calculated '{suggested_check}'."],
                    "clean": clean,
                    "check_digit": suggested_check,
                    "auto_fix_available": True,
                    "suggested_payload": full_payload
                }

        # Case 2: Length doesn't match any standard
        if length not in target_lens:
            return {
                "status": "invalid",
                "errors": [f"Invalid length {length}. Expected {', '.join(str(l) for l in target_lens)} digits (or {', '.join(str(l-1) for l in target_lens)} without check digit)."],
                "clean": clean
            }

        # Case 3: Complete GTIN, verify checksum
        body = clean[:-1]
        provided_check = clean[-1]
        expected_check = cls.calculate_mod10_check_digit(body)

        if provided_check != expected_check:
            corrected = body + expected_check
            return {
                "status": "invalid",
                "errors": [f"Checksum mismatch: received '{provided_check}', expected '{expected_check}'."],
                "clean": clean,
                "check_digit": provided_check,
                "expected_check_digit": expected_check,
                "auto_fix_available": True,
                "suggested_payload": corrected
            }

        return {
            "status": "valid",
            "clean": clean,
            "check_digit": provided_check,
            "expected_check_digit": expected_check
        }

    @classmethod
    def validate_gs1_ai_payload(cls, payload: str) -> Dict[str, Any]:
        """
        Parses and validates bracketed GS1 Application Identifier payloads.
        e.g. (01)09501101530008(17)261231(10)LOT42
        """
        pattern = r'\(([0-9]{2,4})\)([^\(\)]+)'
        matches = re.findall(pattern, payload)

        if not matches:
            return {
                "status": "invalid",
                "errors": ["Payload does not contain standard bracketed GS1 Application Identifiers, e.g. (01)...(10)..."],
                "elements": []
            }

        elements: List[GS1Element] = []
        errors: List[str] = []
        warnings: List[str] = []
        is_gs1_compliant = True

        for ai, val in matches:
            clean_val = val.strip()
            spec = cls.GS1_AI_SPEC.get(ai)
            desc = spec["desc"] if spec else f"Application Identifier ({ai})"
            elem_valid = True
            check_valid = None
            interp = None

            if spec:
                # Length check
                if "len" in spec and len(clean_val) != spec["len"]:
                    errors.append(f"AI ({ai}) '{desc}' requires exactly {spec['len']} characters, got {len(clean_val)}.")
                    elem_valid = False
                elif "min" in spec and (len(clean_val) < spec["min"] or len(clean_val) > spec["max"]):
                    errors.append(f"AI ({ai}) '{desc}' requires between {spec['min']} and {spec['max']} characters.")
                    elem_valid = False

                # Numeric check
                if spec.get("numeric") and not clean_val.isdigit():
                    errors.append(f"AI ({ai}) '{desc}' must be numeric.")
                    elem_valid = False

                # Date interpretation (YYMMDD)
                if spec.get("is_date") and len(clean_val) == 6 and clean_val.isdigit():
                    yy = int(clean_val[0:2])
                    mm = int(clean_val[2:4])
                    dd = int(clean_val[4:6])
                    year = 2000 + yy if yy < 75 else 1900 + yy
                    try:
                        # DD=00 is allowed in GS1 meaning last day of month
                        if dd == 0:
                            interp = f"{year:04d}-{mm:02d} (End of Month)"
                        else:
                            dt = datetime.date(year, mm, dd)
                            interp = dt.strftime("%Y-%m-%d")
                    except ValueError:
                        errors.append(f"AI ({ai}) contains an invalid date '{clean_val}'.")
                        elem_valid = False

                # Check digit check
                if spec.get("check_digit") and clean_val.isdigit() and len(clean_val) >= 8:
                    expected_c = cls.calculate_mod10_check_digit(clean_val[:-1])
                    check_valid = (clean_val[-1] == expected_c)
                    if not check_valid:
                        errors.append(f"AI ({ai}) checksum failed. Expected check digit '{expected_c}', got '{clean_val[-1]}'.")
                        elem_valid = False
            else:
                warnings.append(f"AI ({ai}) is not in standard common GS1 catalog, verified as generic ASCII field.")

            if not elem_valid:
                is_gs1_compliant = False

            elements.append(GS1Element(
                ai=ai,
                description=desc,
                value=clean_val,
                valid=elem_valid,
                check_digit_valid=check_valid,
                interpretation=interp
            ))

        status = "valid" if not errors and not warnings else ("warning" if not errors else "invalid")
        return {
            "status": status,
            "elements": elements,
            "errors": errors,
            "warnings": warnings,
            "is_gs1_compliant": is_gs1_compliant
        }

    @classmethod
    def validate(cls, symbology: str, payload: str, strict_mode: bool = True) -> ValidationResponse:
        """
        Unified validator dispatch across all supported categories.
        """
        sym = symbology.lower().strip()
        raw = payload.strip()
        warnings: List[str] = []
        errors: List[str] = []
        elements: Optional[List[GS1Element]] = None
        auto_fix = False
        suggested = None
        check_digit = None
        expected_check = None
        is_gs1 = False

        if not raw:
            return ValidationResponse(
                status="invalid",
                symbology=sym,
                sanitized_payload="",
                errors=["Payload cannot be empty."]
            )

        # 1. Product Identifiers & Retail
        if sym in ["gtin8", "ean8"]:
            res = cls.validate_gtin(raw, expected_len=8)
            status = res["status"]
            errors.extend(res.get("errors", []))
            warnings.extend(res.get("warnings", []))
            auto_fix = res.get("auto_fix_available", False)
            suggested = res.get("suggested_payload")
            check_digit = res.get("check_digit")
            expected_check = res.get("expected_check_digit")

        elif sym in ["gtin12", "upca", "upc-a"]:
            res = cls.validate_gtin(raw, expected_len=12)
            status = res["status"]
            errors.extend(res.get("errors", []))
            warnings.extend(res.get("warnings", []))
            auto_fix = res.get("auto_fix_available", False)
            suggested = res.get("suggested_payload")
            check_digit = res.get("check_digit")
            expected_check = res.get("expected_check_digit")

        elif sym in ["gtin13", "ean13", "ean-13"]:
            res = cls.validate_gtin(raw, expected_len=13)
            status = res["status"]
            errors.extend(res.get("errors", []))
            warnings.extend(res.get("warnings", []))
            auto_fix = res.get("auto_fix_available", False)
            suggested = res.get("suggested_payload")
            check_digit = res.get("check_digit")
            expected_check = res.get("expected_check_digit")

        elif sym in ["gtin14", "itf14", "itf-14"]:
            res = cls.validate_gtin(raw, expected_len=14)
            status = res["status"]
            errors.extend(res.get("errors", []))
            warnings.extend(res.get("warnings", []))
            auto_fix = res.get("auto_fix_available", False)
            suggested = res.get("suggested_payload")
            check_digit = res.get("check_digit")
            expected_check = res.get("expected_check_digit")

        elif sym in ["upce", "upc-e"]:
            clean = re.sub(r'\D', '', raw)
            if len(clean) not in [6, 7, 8]:
                errors.append(f"UPC-E requires 6, 7, or 8 digits. Received {len(clean)}.")
                status = "invalid"
            else:
                status = "valid"

        # 2. GS1 Formats
        elif sym in ["gs1-128", "gs1_128", "gs1datamatrix", "gs1_datamatrix"]:
            is_gs1 = True
            res = cls.validate_gs1_ai_payload(raw)
            status = res["status"]
            errors.extend(res.get("errors", []))
            warnings.extend(res.get("warnings", []))
            elements = res.get("elements", [])
            is_gs1 = res.get("is_gs1_compliant", False)

        elif sym in ["gs1_digital_link", "digital_link"]:
            is_gs1 = True
            if not raw.startswith("http://") and not raw.startswith("https://"):
                errors.append("GS1 Digital Link must be a valid HTTP or HTTPS URI.")
                status = "invalid"
            elif "/01/" not in raw:
                warnings.append("GS1 Digital Link typically includes primary key AI (01) GTIN path: /01/{gtin}.")
                status = "warning"
            else:
                # Extract GTIN from path /01/([0-9]{8,14})
                m = re.search(r'/01/([0-9]{8,14})', raw)
                if m:
                    gtin_sub = m.group(1)
                    gtin_res = cls.validate_gtin(gtin_sub)
                    if gtin_res["status"] == "invalid":
                        errors.append(f"Embedded GTIN ({gtin_sub}) failed validation: {gtin_res.get('errors', [''])[0]}")
                        status = "invalid"
                    else:
                        status = "valid"
                else:
                    status = "valid"

        # 3. 1D Linear Codes
        elif sym in ["code39", "code-39"]:
            # Valid: 0-9, A-Z, - . $ / + % [space]
            c39_clean = raw.upper()
            if not re.match(r'^[0-9A-Z\-\.\ \$\/\+\%]+$', c39_clean):
                errors.append("Code 39 only allows uppercase A-Z, 0-9, and symbols: - . $ / + % [space]")
                status = "invalid"
            else:
                status = "valid"
                if c39_clean != raw:
                    warnings.append("Code 39 payload was automatically converted to uppercase.")

        elif sym in ["code93", "code-93"]:
            # Code 93 supports standard ASCII
            status = "valid"

        elif sym in ["code128", "code-128"]:
            # Standard ASCII (0-127)
            try:
                raw.encode('ascii')
                status = "valid"
            except UnicodeEncodeError:
                errors.append("Code 128 requires standard ASCII characters (0-127).")
                status = "invalid"

        elif sym in ["codabar", "rationalizedcodabar"]:
            # Codabar: digits, -$:/+ and start/stop chars A,B,C,D
            c_upper = raw.upper()
            if not re.match(r'^[A-D][0-9\-\$\:\/\.\+]+[A-D]$', c_upper):
                warnings.append("Standard Codabar usually begins and ends with delimiters A, B, C, or D.")
                status = "warning"
            else:
                status = "valid"

        elif sym in ["itf", "interleaved2of5"]:
            clean = re.sub(r'\D', '', raw)
            if not clean:
                errors.append("Interleaved 2 of 5 must contain numeric digits.")
                status = "invalid"
            elif len(clean) % 2 != 0:
                warnings.append(f"ITF requires an even number of digits (currently {len(clean)}). A leading zero will be prepended.")
                auto_fix = True
                suggested = "0" + clean
                status = "warning"
            else:
                status = "valid"

        # 4. UUID & GUID
        elif sym in ["uuid", "uuidv4", "uuidv7", "guid"]:
            uuid_pattern = r'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
            if re.match(uuid_pattern, raw.strip('{}')):
                status = "valid"
            else:
                errors.append("Invalid UUID/GUID format. Expected 8-4-4-4-12 hexadecimal notation.")
                status = "invalid"

        # 5. 2D Matrix & Stacked (QR, Data Matrix, PDF417, Aztec, MaxiCode, Han Xin)
        elif sym in ["qrcode", "qr", "microqrcode", "datamatrix", "pdf417", "micropdf417", "azteccode", "maxicode", "hanxin"]:
            if len(raw) > 7000:
                errors.append("Payload exceeds maximum capacity for 2D barcode symbols (7,000 characters).")
                status = "invalid"
            else:
                status = "valid"

        else:
            # Generic fallback
            status = "valid"

        return ValidationResponse(
            status=status,
            symbology=sym,
            sanitized_payload=raw,
            is_gs1_compliant=is_gs1,
            check_digit=check_digit,
            expected_check_digit=expected_check,
            elements=elements,
            warnings=warnings,
            errors=errors,
            auto_fix_available=auto_fix,
            suggested_payload=suggested
        )

