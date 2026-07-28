from pathlib import Path

p = Path(r"d:/final-project/Verfication-Project-Using-Machine-Learning/backend-node/src/services/dockerOrchestrator.service.js")
t = p.read_text(encoding="utf-8")
old = (
    "  if (splitStackPair) {\n"
    "    apiHostPort = await allocateHostPort();\n"
    "    while (apiHostPort === hostPort) {\n"
    "      apiHostPort = await allocateHostPort();\n"
    "    }\n"
)
new = (
    "  if (splitStackPair) {\n"
    "    apiHostPort = await allocateHostPort();\n"
    "    let portTries = 0;\n"
    "    while (apiHostPort === hostPort && portTries < 50) {\n"
    "      apiHostPort = await allocateHostPort();\n"
    "      portTries += 1;\n"
    "    }\n"
    "    if (apiHostPort === hostPort) {\n"
    "      const err = new Error('Could not allocate a distinct API preview port. Try again.');\n"
    "      err.status = 503;\n"
    "      throw err;\n"
    "    }\n"
)
# Normalize to LF for matching after Python read_text which keeps \n from \r\n on Windows? 
# read_text keeps \r\n as \n only if... actually keeps \r\n on Windows as \r\n in text mode? 
# In Python 3 text mode, universal newlines convert \r\n to \n on read.
if old not in t:
    raise SystemExit("pattern not found")
p.write_text(t.replace(old, new, 1), encoding="utf-8", newline="\n")
print("patched ok")
