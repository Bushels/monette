# Top-level conftest.py — establishes pytest rootdir so that test files
# can do `from scripts.gee_pipeline.qc import ...` etc.
#
# pytest finds this file walking up from the tests/ directory and adds
# the directory containing it (this directory) to sys.path automatically.
