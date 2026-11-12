#!/bin/zsh
# seat.sh <verb> <json-args>  — one tools/call at the public dev seat with the session's own key; prints the text reply.
curl -s -X POST https://mcp.clicktooling.com/dev -H "content-type: application/json" -H "X-Dev-Token: ${PT_DEV_MCP_TOKEN}" \
  -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"tools/call\",\"params\":{\"name\":\"$1\",\"arguments\":$2}}" \
  | python3 -c "import sys,json; r=json.load(sys.stdin); c=r.get('result',{}).get('content',[{}]); print(c[0].get('text', json.dumps(r))[:int(sys.argv[1])])" "${3:-6000}"
