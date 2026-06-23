#!/usr/bin/env python3
# Static server para o MVP — evita os.getcwd() (bloqueado no sandbox) usando directory= explícito.
import os
import http.server
import socketserver
from functools import partial

# Diretório do próprio script (sem os.getcwd(), bloqueado no sandbox do preview).
DIR = os.path.dirname(os.path.abspath(__file__))
PORT = 8080


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    # Sempre servir a versão mais nova no preview (sem cache do navegador).
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()


Handler = partial(NoCacheHandler, directory=DIR)
socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(("127.0.0.1", PORT), Handler) as httpd:
    print(f"Servindo {DIR} em http://127.0.0.1:{PORT}")
    httpd.serve_forever()
