-- Aplicar una vez mediante wrangler d1 migrations apply. Guardar copia antes.
INSERT OR IGNORE INTO Cuentas_Usuario(ID_Empleado,Rol) SELECT ID_Empleado,'admin' FROM Administrador;
INSERT OR IGNORE INTO Cuentas_Usuario(ID_Empleado,Rol) SELECT ID_Empleado,'trabajador' FROM Trabajadores;
CREATE TABLE Identidad_Usuario (
 ID_Empleado INTEGER PRIMARY KEY REFERENCES Empleados(ID_Empleado),
 Nombres TEXT NOT NULL, Apellido_Paterno TEXT NOT NULL DEFAULT '', Apellido_Materno TEXT NOT NULL DEFAULT '',
 Correo_Personal TEXT, Correo_Corporativo TEXT NOT NULL COLLATE NOCASE UNIQUE,
 Revisar_Nombre INTEGER NOT NULL DEFAULT 0 CHECK(Revisar_Nombre IN (0,1)),
 Requiere_Clave INTEGER NOT NULL DEFAULT 0 CHECK(Requiere_Clave IN (0,1))
);
-- No se adivina la separación de apellidos. Se conserva el texto original en Nombres.
-- Primer nombre normalizado y sufijo correlativo si hay duplicados.
WITH RECURSIVE Iniciales AS (
 SELECT E.ID_Empleado,E.Nombre_Completo,E.Correo,
 CASE WHEN COALESCE(C.Rol,CASE WHEN EXISTS(SELECT 1 FROM Administrador A WHERE A.ID_Empleado=E.ID_Empleado) THEN 'admin' ELSE 'trabajador' END)='admin' THEN 'admin.' ELSE 'user.' END AS Prefijo,
 replace(replace(lower(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(substr(trim(E.Nombre_Completo),1,instr(trim(E.Nombre_Completo)||' ',' ')-1),'Á','A'),'É','E'),'Í','I'),'Ó','O'),'Ú','U'),'Ü','U'),'Ñ','N'),'á','a'),'é','e'),'í','i'),'ó','o'),'ú','u'),'ü','u'),'ñ','n')),'''',''),'-','') AS Inicial
 FROM Empleados E LEFT JOIN Cuentas_Usuario C ON C.ID_Empleado=E.ID_Empleado
), Letras(ID_Empleado,Resto,Limpio) AS (
 SELECT ID_Empleado,Inicial,'' FROM Iniciales
 UNION ALL SELECT ID_Empleado,substr(Resto,2),Limpio || CASE WHEN substr(Resto,1,1) GLOB '[a-z]' THEN substr(Resto,1,1) ELSE '' END FROM Letras WHERE length(Resto)>0
), Bases AS (
 SELECT I.ID_Empleado,I.Nombre_Completo,I.Correo,I.Prefijo || CASE WHEN L.Limpio='' THEN 'persona' ELSE substr(L.Limpio,1,40) END AS Base
 FROM Iniciales I JOIN Letras L USING(ID_Empleado) WHERE L.Resto=''
), Numeradas AS (SELECT *,ROW_NUMBER() OVER(PARTITION BY Base ORDER BY ID_Empleado) AS N FROM Bases)
INSERT INTO Identidad_Usuario(ID_Empleado,Nombres,Correo_Personal,Correo_Corporativo,Revisar_Nombre,Requiere_Clave)
 SELECT ID_Empleado,Nombre_Completo,Correo,Base || CASE WHEN N=1 THEN '' ELSE CAST(N AS TEXT) END || '@arqyservgen.com',1,
 CASE WHEN EXISTS(SELECT 1 FROM Administrador A WHERE A.ID_Empleado=Numeradas.ID_Empleado AND A.PIN_Acceso NOT LIKE 'pbkdf2$%') OR EXISTS(SELECT 1 FROM Trabajadores T WHERE T.ID_Empleado=Numeradas.ID_Empleado AND T.PIN_Acceso NOT LIKE 'pbkdf2$%') THEN 1 ELSE 0 END
 FROM Numeradas;
-- Eliminar credenciales sin hash; recuperación mediante herramienta local o administrador.
UPDATE Administrador SET PIN_Acceso='disabled$'||lower(hex(randomblob(32))) WHERE PIN_Acceso NOT LIKE 'pbkdf2$%';
UPDATE Trabajadores SET PIN_Acceso='disabled$'||lower(hex(randomblob(32))) WHERE PIN_Acceso NOT LIKE 'pbkdf2$%';
CREATE TABLE Sesiones_Seguras (ID TEXT PRIMARY KEY,ID_Empleado INTEGER NOT NULL REFERENCES Empleados(ID_Empleado), Expira INTEGER NOT NULL);
CREATE INDEX IX_Sesiones_Expira ON Sesiones_Seguras(Expira);
CREATE TABLE Limites_Seguridad (Clave TEXT PRIMARY KEY, Ventana INTEGER NOT NULL, Usados INTEGER NOT NULL);
CREATE INDEX IX_Limites_Ventana ON Limites_Seguridad(Ventana);
