import os
import json
import yaml

def get_schema_mock(schema, components):
    """Generate mock value from OpenAPI schema definition recursively."""
    if not isinstance(schema, dict):
        return None

    if "$ref" in schema:
        ref_name = schema["$ref"].split("/")[-1]
        ref_schema = components.get(ref_name, {})
        return get_schema_mock(ref_schema, components)

    if "anyOf" in schema:
        non_null = [s for s in schema["anyOf"] if s.get("type") != "null"]
        if non_null:
            return get_schema_mock(non_null[0], components)

    t = schema.get("type")
    
    if t == "string":
        if "example" in schema:
            return schema["example"]
        fmt = schema.get("format")
        if fmt == "date-time":
            return "2026-06-30T16:00:00Z"
        if fmt == "email":
            return "user@example.com"
        return "string"
    
    if t == "integer":
        if "example" in schema:
            return schema["example"]
        return 1
        
    if t == "number":
        if "example" in schema:
            return schema["example"]
        return 1.0
        
    if t == "boolean":
        if "example" in schema:
            return schema["example"]
        return True
        
    if t == "array":
        items = schema.get("items", {})
        return [get_schema_mock(items, components)]
        
    if t == "object":
        res = {}
        props = schema.get("properties", {})
        for name, prop in props.items():
            res[name] = get_schema_mock(prop, components)
        return res
        
    return None

def normalize_path(path_list):
    """Convert Postman path list to a normalized string path matching openapi."""
    cleaned = []
    for p in path_list:
        p_str = str(p)
        if p_str.startswith("{{") and p_str.endswith("}}"):
            cleaned.append("{" + p_str[2:-2] + "}")
        else:
            cleaned.append(p_str)
    path_str = "/" + "/".join(cleaned)
    return path_str.replace("//", "/")

def get_openapi_info(paths_def, path_normalized, method):
    """Find the OpenAPI route definition matching a path and method."""
    method_lower = method.lower()
    
    if path_normalized in paths_def:
        route_def = paths_def[path_normalized]
        if method_lower in route_def:
            return route_def[method_lower]

    if path_normalized.endswith("/"):
        alt_path = path_normalized[:-1]
    else:
        alt_path = path_normalized + "/"

    if alt_path in paths_def:
        route_def = paths_def[alt_path]
        if method_lower in route_def:
            return route_def[method_lower]
            
    return None

def process_postman_item(item, paths_def, components):
    """Recursively search items for requests and populate mock response objects."""
    if "request" in item:
        req = item["request"]
        method = req["method"]
        path_list = req.get("url", {}).get("path", [])
        
        path_normalized = normalize_path(path_list)
        route_def = get_openapi_info(paths_def, path_normalized, method)
        
        if route_def:
            responses = route_def.get("responses", {})
            success_code = None
            success_def = None
            
            for code in ["200", "201", "204"]:
                if code in responses:
                    success_code = code
                    success_def = responses[code]
                    break
                    
            if success_code and success_def:
                code_val = int(success_code)
                status_text = "OK" if success_code == "200" else "Created" if success_code == "201" else "No Content"
                
                content = success_def.get("content", {})
                json_schema = content.get("application/json", {}).get("schema", {})
                
                if json_schema:
                    mock_body = get_schema_mock(json_schema, components)
                    body_str = json.dumps(mock_body, indent=4)
                else:
                    body_str = ""

                postman_resp = {
                    "name": "Successful Response",
                    "originalRequest": {
                        "method": method,
                        "header": req.get("header", []),
                        "body": req.get("body", {}),
                        "url": req.get("url", {})
                    },
                    "status": status_text,
                    "code": code_val,
                    "_postman_previewlanguage": "json" if body_str else "text",
                    "header": [
                        {
                            "key": "Content-Type",
                            "value": "application/json",
                            "type": "text"
                        }
                    ] if body_str else [],
                    "cookie": [],
                    "body": body_str
                }
                item["response"] = [postman_resp]
                print(f"Set response for: {method} {path_normalized} -> {success_code}")
        else:
            print(f"Warning: Could not find OpenAPI match for: {method} {path_normalized}")
            
    if "item" in item:
        for sub_item in item["item"]:
            process_postman_item(sub_item, paths_def, components)

def main():
    """Main runner to load OpenAPI, parse it, and write mock responses into the Postman collection."""
    script_dir = os.path.dirname(os.path.abspath(__file__))
    backend_dir = os.path.dirname(script_dir)
    
    yaml_path = os.path.join(backend_dir, "openapi.yaml")
    postman_path = os.path.join(backend_dir, "postman", "AI-Powerd-Web-App-API.postman_collection.json")
    
    with open(yaml_path, "r", encoding="utf-8") as f:
        openapi_data = yaml.safe_load(f)
        
    with open(postman_path, "r", encoding="utf-8") as f:
        postman_data = json.load(f)
        
    paths_def = openapi_data.get("paths", {})
    components = openapi_data.get("components", {}).get("schemas", {})
    
    for item in postman_data.get("item", []):
        process_postman_item(item, paths_def, components)
        
    with open(postman_path, "w", encoding="utf-8") as f:
        json.dump(postman_data, f, indent=4)
        
    print("Postman collection updated successfully with mock responses!")

if __name__ == "__main__":
    main()
