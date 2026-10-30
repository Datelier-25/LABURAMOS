"""Servidor de vista previa: sirve el proyecto y agrega /__preview.html (arnés sin Node)."""
import functools
import http.server
import os
import sys

ROOT = sys.argv[1]
PORT = int(sys.argv[2]) if len(sys.argv) > 2 else 5199
HERE = os.path.dirname(os.path.abspath(__file__))


class Handler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path.split('?')[0] in ('/', '/__preview.html'):
            body = open(os.path.join(HERE, 'harness.html'), 'rb').read()
            self.send_response(200)
            self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.send_header('Cache-Control', 'no-store')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        return super().do_GET()

    def translate_path(self, path):
        # Igual que Vite: lo que no está en la raíz se busca en public/
        p = super().translate_path(path)
        if not os.path.exists(p):
            alt = os.path.join(ROOT, 'public', os.path.relpath(p, ROOT))
            if os.path.exists(alt):
                return alt
        return p

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def guess_type(self, path):
        if path.endswith(('.jsx', '.js')):
            return 'text/plain; charset=utf-8'
        return super().guess_type(path)


http.server.ThreadingHTTPServer(('127.0.0.1', PORT), functools.partial(Handler, directory=ROOT)).serve_forever()
