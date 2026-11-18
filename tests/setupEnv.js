process.env.NODE_ENV = 'test';
process.env.TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgres://room_booking:room_booking_dev@127.0.0.1:5433/room_booking_test';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_key_for_integration_testing_1234567890';
process.env.JWT_EXPIRES_IN = '15m';
