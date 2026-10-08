#!/bin/bash
echo "Waiting for SQL Server..."
ready=0
for _ in $(seq 1 60); do
  /opt/mssql-tools/bin/sqlcmd -S localhost -U sa -P "$SA_PASSWORD" -Q "SELECT 1" && ready=1 && break
  sleep 2
done

if [ "$ready" -ne 1 ]; then
  echo "SQL Server did not become ready."
  exit 1
fi

echo "Creating database..."
/opt/mssql-tools/bin/sqlcmd -S localhost -U sa -P "$SA_PASSWORD" -d master -v DB_NAME="$DB_NAME" -i /usr/src/app/create-database.sql
echo "Done."
