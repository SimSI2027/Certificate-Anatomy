# CSR anatomy

The request `fixtures/requests/app01-request.csr` is a PKCS #10 `CertificationRequest` (RFC 2986). The app parses it at runtime; every value shown comes from these bytes.

```
CertificationRequest
├── CertificationRequestInfo                 (signed by APP01)
│   ├── Version                              v1, encoded 0
│   ├── Subject                              CN=app.simsi2027.test, O=SIMSI2027 Synthetic Lab
│   ├── SubjectPublicKeyInfo
│   │   ├── Algorithm                        rsaEncryption
│   │   └── Public Key                       RSA 2048, e = 65537
│   └── Attributes [0]
│       ├── Extension Request (1.2.840.113549.1.9.14)
│       │   ├── Subject Alternative Name     DNS app.simsi2027.test, www.app.simsi2027.test
│       │   ├── Key Usage (critical)         Digital Signature, Key Encipherment
│       │   └── Enhanced Key Usage           Server Authentication
│       └── Enrollment Name-Value Pair (1.3.6.1.4.1.311.13.2.1)
│           └── CertificateTemplate: SIMSI2027ManualWebServer
├── Signature Algorithm                      sha256WithRSAEncryption
└── Signature Value                          2048-bit RSA signature by APP01's private key
```

## How it was created (conceptually)

`certreq -new -machine app01-request.inf app01-request.csr` on APP01 (shown, never executed):

1. Generate the private key inside APP01's machine key store (non-exportable).
2. Derive the public key.
3. Build CertificationRequestInfo: subject, SubjectPublicKeyInfo, requested extensions, template hint.
4. Sign CertificationRequestInfo with the APP01 private key (proof of possession).
5. Encode as DER, then Base64 inside PEM armour.

The private key stays on APP01. It is shown beside the CSR, never inside it, linked to the public key by a dashed "mathematical pair" line. A pending request also appears in Local Computer › Certificate Enrollment Requests until `certreq -accept`.

## Template hint

The template name travels as a separate signed attribute (as certreq's `[RequestAttributes]` produces), not as an extension request. It asks for nothing; it tells an Enterprise CA which policy to evaluate. The same hint could instead be supplied as submission metadata (`certreq -attrib`).

## Field questions answered in the inspector

For every CSR field: what it is, why it is present, who supplied it, whether the CSR signature covers it, whether it is secret, whether it travels to the CA, how it relates to the issued certificate, and what could go wrong.

## Simplifications

Real certreq requests usually carry more Microsoft attributes (OS version, client information, CSP information) and often a Subject Key Identifier request. They are omitted to keep the structure focused; see [LIMITATIONS.md](LIMITATIONS.md).
