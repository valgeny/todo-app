FROM mcr.microsoft.com/mssql/server:2019-latest

WORKDIR /usr/src/app

COPY entrypoint.sh run-initialization.sh create-database.sql ./

EXPOSE 1433

CMD ["/bin/bash", "/usr/src/app/entrypoint.sh"]
