import os
import sys
import yaml

script_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.dirname(script_dir)
sys.path.insert(0, backend_dir)

from main import app


def generate_openapi_yaml():
    """Extract openapi JSON from FastAPI app, convert to YAML, and save to backend/openapi.yaml."""
    openapi_schema = app.openapi()
    output_path = os.path.join(backend_dir, "openapi.yaml")
    
    with open(output_path, "w", encoding="utf-8") as f:
        yaml.dump(openapi_schema, f, default_flow_style=False, sort_keys=False)


if __name__ == "__main__":
    generate_openapi_yaml()
