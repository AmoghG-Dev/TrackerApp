from database import check_database_connection

if check_database_connection():
    print("MongoDB connected successfully!")