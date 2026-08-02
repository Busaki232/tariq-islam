SQLALCHEMY_DATABASE_URI = (
    "mysql+pymysql://{MYSQL_USER}:{MYSQL_PASSWORD}"
    "@{MYSQL_HOST}:{MYSQL_PORT}/{MYSQL_DATABASE}"
).format(**os.environ)
