"""Regenera public/geo/localidades.json desde la API Georef (datos.gob.ar).

Uso: python generar_localidades.py <ruta a public/geo/localidades.json>

Formato compacto que lee src/lib/geo.js:
  { "fuente": "...", "provincias": ["Buenos Aires", ...], "localidades": [["Bragado", 0], ...] }
cada localidad es [nombre, índice de la provincia]. Se eliminan duplicados (mismo nombre en la misma provincia)
y "Tierra del Fuego, Antártida e Islas del Atlántico Sur" se guarda como "Tierra del Fuego"
(geo.js aplica la misma regla con cleanProvince()).
"""
import json
import sys
import urllib.request

URL = 'https://apis.datos.gob.ar/georef/api/localidades?campos=nombre,provincia.nombre&max=5000'

with urllib.request.urlopen(URL, timeout=60) as r:
    data = json.load(r)
if data.get('total', 0) > data.get('cantidad', 0):
    raise SystemExit(f"Georef devolvió {data['cantidad']} de {data['total']}: hay que paginar con &inicio=")

short = lambda p: 'Tierra del Fuego' if p.startswith('Tierra del Fuego') else p
locs = data['localidades']
provs = sorted({short(x['provincia']['nombre']) for x in locs})
pairs = sorted({(x['nombre'].strip(), provs.index(short(x['provincia']['nombre']))) for x in locs}, key=lambda t: (t[0].lower(), t[1]))
out = {'fuente': 'Georef API (datos.gob.ar), localidades', 'provincias': provs, 'localidades': [[n, i] for n, i in pairs]}
with open(sys.argv[1], 'w', encoding='utf-8') as f:
    json.dump(out, f, ensure_ascii=False, separators=(',', ':'))
print(len(locs), 'localidades ->', len(pairs), 'únicas en', len(provs), 'provincias')
