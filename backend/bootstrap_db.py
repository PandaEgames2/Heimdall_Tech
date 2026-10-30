#!/usr/bin/env python3
"""Bootstrap the MySQL database from the project SQL file without MySQL Workbench.

This script connects to a MySQL server using environment variables from `.env`
or CLI arguments and executes the project schema/data file.

Examples:
    python bootstrap_db.py --check
    python bootstrap_db.py --check-schema
    python bootstrap_db.py --execute
    python bootstrap_db.py --host cloud-db.example.com --user admin --password secret --database heimdall_tech --execute
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

# Tablas funcionales mínimas que no puede crear `manage.py migrate`.
# RECURSO, USUARIO_HAS_ROL y ROL_HAS_RECURSO las añade ensure_rbac_schema
# automáticamente sobre una base anterior.
BASE_TABLES = ("PLAN", "ESTABLECIMIENTO", "ROL", "USUARIO")

try:
    import mysql.connector
    from mysql.connector import Error as MySQLError
except ImportError as exc:  # pragma: no cover - runtime dependency guard
    raise SystemExit(
        "Falta mysql-connector-python. Instálalo con: pip install -r requirements.txt"
    ) from exc


def get_env_path() -> Path:
    return Path(__file__).resolve().parent / ".env"


def load_project_env() -> None:
    env_path = get_env_path()
    if env_path.exists():
        load_dotenv(env_path)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Bootstrap the project database without Workbench.")
    parser.add_argument("--check", action="store_true", help="Solo valida que la conexión y las credenciales sean correctas.")
    parser.add_argument("--check-schema", action="store_true", help="Verifica que la base tenga las tablas base de Heimdall.")
    parser.add_argument("--execute", action="store_true", help="Ejecuta el script SQL del proyecto en la base de datos.")
    parser.add_argument("--host", default=os.getenv("DB_HOST", "127.0.0.1"), help="Host de MySQL.")
    parser.add_argument("--port", default=os.getenv("DB_PORT", "3306"), help="Puerto de MySQL.")
    parser.add_argument("--user", default=os.getenv("DB_USER", "root"), help="Usuario de MySQL.")
    parser.add_argument("--password", default=os.getenv("DB_PASSWORD", ""), help="Contraseña de MySQL.")
    parser.add_argument("--database", default=os.getenv("DB_NAME", "heimdall_tech"), help="Base de datos a crear o usar.")
    parser.add_argument(
        "--sql-file",
        default=str(Path(__file__).resolve().parent.parent / "Heimdall_Tech.sql"),
        help="Ruta del archivo SQL del proyecto.",
    )
    return parser


def get_connection_kwargs(args: argparse.Namespace) -> dict:
    return {
        "host": args.host,
        "port": int(args.port),
        "user": args.user,
        "password": args.password,
        "autocommit": True,
    }


def read_sql_file(path: Path) -> str:
    if not path.exists():
        raise FileNotFoundError(f"No se encontró el archivo SQL: {path}")
    return path.read_text(encoding="utf-8")


def execute_sql_script(sql_text: str, connection_kwargs: dict) -> None:
    connection = mysql.connector.connect(**connection_kwargs)
    cursor = connection.cursor()
    try:
        for result in cursor.execute(sql_text, multi=True):
            if result is not None and hasattr(result, "fetchall"):
                result.fetchall()
        connection.commit()
        print("SQL ejecutado correctamente.")
    finally:
        cursor.close()
        connection.close()


def validate_connection(connection_kwargs: dict) -> None:
    connection = mysql.connector.connect(**connection_kwargs)
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT VERSION();")
            version = cursor.fetchone()[0]
        print(f"Conexión MySQL exitosa. Versión: {version}")
    finally:
        connection.close()


def validate_schema(connection_kwargs: dict, database: str) -> None:
    try:
        connection = mysql.connector.connect(**connection_kwargs, database=database)
    except MySQLError as exc:
        raise ValueError(
            f"No se pudo abrir la base '{database}'. "
            "Si es una instalación nueva, importa el esquema una sola vez con "
            "`python backend/bootstrap_db.py --execute`. "
            f"Detalle de MySQL: {exc}"
        ) from exc

    try:
        placeholders = ", ".join(["%s"] * len(BASE_TABLES))
        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT TABLE_NAME FROM information_schema.TABLES "
                f"WHERE TABLE_SCHEMA = %s AND TABLE_NAME IN ({placeholders})",
                (database, *BASE_TABLES),
            )
            existing = {str(row[0]).upper() for row in cursor.fetchall()}
    finally:
        connection.close()

    missing = [table for table in BASE_TABLES if table not in existing]
    if missing:
        raise ValueError(
            "La base existe pero le faltan tablas base de Heimdall: "
            + ", ".join(missing)
            + ". Importa el esquema una sola vez con "
            + "`python backend/bootstrap_db.py --execute` o ejecuta "
            + "Heimdall_Tech.sql en MySQL Workbench."
        )
    print(f"Esquema Heimdall verificado: {len(BASE_TABLES)} tablas base presentes.")


def main() -> int:
    load_project_env()
    parser = build_parser()
    args = parser.parse_args()

    if not args.check and not args.check_schema and not args.execute:
        parser.error("Debes usar --check, --check-schema o --execute.")

    connection_kwargs = get_connection_kwargs(args)

    try:
        if args.check:
            validate_connection(connection_kwargs)
        if args.check_schema:
            validate_schema(connection_kwargs, args.database)
        if args.execute:
            sql_path = Path(args.sql_file).resolve()
            sql_text = read_sql_file(sql_path)
            execute_sql_script(sql_text, connection_kwargs)
        return 0
    except (FileNotFoundError, MySQLError, ValueError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
