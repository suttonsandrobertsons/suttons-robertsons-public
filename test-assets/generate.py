import os
import zipfile

def make_png(path):
    # 1x1 pixel transparent PNG
    data = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4\x00\x00\x00\rIDATx\x9cc`\x00\x01\x00\x00\xff\xff\x03\x00\x00\x06\x00\x05Wbf\n\x00\x00\x00\x00IEND\xaeB`\x82'
    with open(path, 'wb') as f:
        f.write(data)
    print(f"Generated PNG: {path} ({len(data)} bytes)")

def make_pdf(path):
    # Minimal valid PDF 1.4 structure
    pdf_content = (
        b"%PDF-1.4\n"
        b"1 0 obj <</Type /Catalog /Pages 2 0 R>> endobj\n"
        b"2 0 obj <</Type /Pages /Kids [3 0 R] /Count 1>> endobj\n"
        b"3 0 obj <</Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources <<>> /Contents 4 0 R>> endobj\n"
        b"4 0 obj <</Length 21>> stream\nBT /F1 12 Tf ET\nendstream\nendobj\n"
        b"xref\n"
        b"0 5\n"
        b"0000000000 65535 f \n"
        b"0000000009 00000 n \n"
        b"0000000057 00000 n \n"
        b"0000000111 00000 n \n"
        b"0000000212 00000 n \n"
        b"trailer <</Size 5 /Root 1 0 R>>\n"
        b"startxref\n"
        b"282\n"
        b"%%EOF\n"
    )
    with open(path, 'wb') as f:
        f.write(pdf_content)
    print(f"Generated PDF: {path} ({len(pdf_content)} bytes)")

def make_docx(path):
    # DOCX is a zip file containing OpenXML structure
    with zipfile.ZipFile(path, 'w') as z:
        z.writestr('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>')
        z.writestr('word/document.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Suttons Form Test Document Content</w:t></w:r></w:p></w:body></w:document>')
    print(f"Generated DOCX: {path} ({os.path.getsize(path)} bytes)")

def make_mp4(path):
    # Minimal MP4 box structure (ftyp + mdat) over 100 bytes
    ftyp = b'\x00\x00\x00\x18ftypmp42\x00\x00\x00\x00mp42isom'
    mdat = b'\x00\x00\x00\x64mdat' + b'\x00' * 92
    with open(path, 'wb') as f:
        f.write(ftyp + mdat)
    print(f"Generated MP4: {path} ({len(ftyp + mdat)} bytes)")

if __name__ == '__main__':
    os.makedirs('test-assets', exist_ok=True)
    make_png('test-assets/test.png')
    make_pdf('test-assets/test.pdf')
    make_docx('test-assets/test.docx')
    make_mp4('test-assets/test.mp4')
