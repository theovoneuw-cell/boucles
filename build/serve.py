#!/usr/bin/env python3
"""Serveur de prévisualisation locale. Types MIME corrects et cache désactivé,
pour ne pas relire une version périmée pendant qu'on travaille."""
import http.server, socketserver, sys, mimetypes

mimetypes.add_type('application/manifest+json', '.webmanifest')
mimetypes.add_type('text/javascript', '.js')
mimetypes.add_type('font/woff2', '.woff2')

class H(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        super().end_headers()
    def log_message(self, fmt, *a):
        sys.stderr.write("  %s\n" % (fmt % a))

port = int(sys.argv[1])
socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(("127.0.0.1", port), H) as s:
    print("→ http://localhost:%d/" % port, flush=True)
    s.serve_forever()
