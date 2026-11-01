# Certificate anatomy

The issued leaf `fixtures/certificates/app-simsi2027-test.cer` is an X.509 v3 certificate (RFC 5280), signed by SIMSI2027 Issuing CA 01.

```
Certificate
├── TBSCertificate                           (signed by the Issuing CA)
│   ├── Version                              V3 (encoded 2)
│   ├── Serial Number                        16 bytes, chosen by the CA
│   ├── Signature Algorithm                  sha256WithRSAEncryption
│   ├── Issuer                               CN=SIMSI2027 Issuing CA 01, O=SIMSI2027 Synthetic Lab
│   ├── Validity
│   │   ├── Not Before                       2 Nov 2026 09:31 UTC (10 min before issuance, ADCS skew default)
│   │   └── Not After                        2 Nov 2027 09:41 UTC
│   ├── Subject                              CN=app.simsi2027.test, O=SIMSI2027 Synthetic Lab
│   ├── SubjectPublicKeyInfo                 identical bytes to the CSR
│   │   ├── Algorithm
│   │   └── Public Key
│   └── Extensions [3]
│       ├── Subject Alternative Name         DNS app.simsi2027.test, www.app.simsi2027.test
│       ├── Key Usage (critical)             Digital Signature, Key Encipherment
│       ├── Enhanced Key Usage               Server Authentication
│       ├── Basic Constraints (critical)     cA = FALSE
│       ├── Subject Key Identifier           SHA-1 of the public key bits
│       ├── Authority Key Identifier         = Issuing CA Subject Key Identifier
│       ├── Authority Information Access     CA Issuers: http://pki.simsi2027.test/aia/SIMSI2027-Issuing-CA-01.crt
│       └── CRL Distribution Points          http://pki.simsi2027.test/cdp/SIMSI2027-Issuing-CA-01.crl
├── Certificate Signature Algorithm          sha256WithRSAEncryption
└── Certificate Signature Value              4096-bit RSA signature by the Issuing CA private key
```

A **Thumbprint** plate sits outside the structure, drawn dashed: it is computed over the whole encoded certificate (SHA-1 as Windows shows it, plus SHA-256) and is not stored inside it.

## Inspector contract

For every field: what it is, who selected or created it, whether it came from the CSR, whether the CA approved, replaced, derived or added it, whether it is signed, whether it is secret, how it is used during validation, and a common failure.

## Deliberate omissions

- **Certificate Template Information** (1.3.6.1.4.1.311.21.7), which ADCS adds for version 2+ templates, is omitted; the Extensions explanation says so.
- **OCSP** is not published; AIA carries CA Issuers only and revocation uses the CDP. Stated in the AIA explanation.

## Chain

```
SIMSI2027 Root CA            self-signed, offline, RSA 4096, 2026–2046
└── SIMSI2027 Issuing CA 01  signed by the Root in Jan 2026, pathLen 0, RSA 4096, 2026–2036
    └── app.simsi2027.test   signed by the Issuing CA, RSA 2048, 2026–2027
```

The Root CA never signs, sees or is contacted for the leaf.
