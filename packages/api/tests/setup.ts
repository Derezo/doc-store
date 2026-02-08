process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-that-is-at-least-32-characters-long';
process.env.DATA_DIR = '/tmp/doc-store-test-data';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://docstore:docstore_dev@localhost:5432/docstore_test';
process.env.BASE_URL = 'http://localhost:4000';
