-- ============================================================================
-- HighCourt — raw staging tables for Supabase (PostgreSQL)
-- Mirrors the SQL Server [HighCourt] schema 1:1 so exported data loads as-is.
-- Type mapping: nvarchar/varchar(max)/ntext -> text, datetime -> timestamp,
--               float -> double precision, IDENTITY -> plain integer.
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS staging;

-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS staging."From2018";
CREATE TABLE staging."From2018" (
    "RegdNo"       bigint,
    "Petitioner"   varchar(255),
    "Respondets"   text,
    "Adv"          varchar(255),
    "Dated"        timestamp,
    "Copies"       varchar(255),
    "District"     varchar(255),
    "RespndentNo"  double precision,
    "Type"         varchar(255),
    "Remark"       varchar(255),
    "AdvAddress"   varchar(255),
    "AdvMoNo"      varchar(255),
    "LongType"     varchar(255),
    "CYear"        varchar(255)
);

-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS staging."tbl17";
CREATE TABLE staging."tbl17" (
    "RegdNo"       double precision,
    "Petitioner"   varchar(255),
    "Respondets"   varchar(255),
    "Adv"          varchar(255),
    "Dated"        timestamp,
    "Copies"       double precision,
    "District"     varchar(255),
    "RespndentNo"  varchar(255),
    "Type"         varchar(255),
    "Remark"       varchar(255),
    "AdvAddress"   varchar(255),
    "AdvMoNo"      varchar(255),
    "LongType"     varchar(255),
    "CYear"        double precision
);

-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS staging."tblAdvmaster";
CREATE TABLE staging."tblAdvmaster" (
    "Id"        integer,
    "AdvName"   text,
    "Address"   text,
    "MoNo"      text
);

-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS staging."tblDatabaseName";
CREATE TABLE staging."tblDatabaseName" (
    "MyServerName"    varchar(500),
    "MyDatabaseName"  varchar(500),
    "MyPath"          varchar(500)
);

-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS staging."tblDepartment";
CREATE TABLE staging."tblDepartment" (
    "ID"    integer NOT NULL,
    "Dept"  text,
    CONSTRAINT "PK_tblDepartment" PRIMARY KEY ("ID")
);

-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS staging."tblDept";
CREATE TABLE staging."tblDept" (
    "Id"    integer,
    "Name"  text,
    "Dept"  text
);

-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS staging."tblDistrct";
CREATE TABLE staging."tblDistrct" (
    "Id"        integer NOT NULL,
    "District"  text,
    CONSTRAINT "PK_tblDistrct" PRIMARY KEY ("Id")
);

-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS staging."tblHighCourt";
CREATE TABLE staging."tblHighCourt" (
    "RegdNo"       bigint,
    "Petitioner"   text,
    "Respondets"   text,
    "Adv"          text NOT NULL,
    "Dated"        timestamp,
    "Copies"       varchar(50),
    "District"     text,
    "RespndentNo"  text,
    "Type"         text,
    "Remark"       text,
    "AdvAddress"   text,
    "AdvMoNo"      text,
    "LongType"     text
);

-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS staging."tblInfo";
CREATE TABLE staging."tblInfo" (
    "Date"    timestamp,
    "No"      bigint,
    "Info"    text,
    "Remark"  text
);

-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS staging."tblLogin1";
CREATE TABLE staging."tblLogin1" (
    "UserName"  text,
    "Password"  text
);

-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS staging."tblPetitioner";
CREATE TABLE staging."tblPetitioner" (
    "ID"          integer NOT NULL,
    "Petitioner"  text,
    CONSTRAINT "PK_tblPetitioner" PRIMARY KEY ("ID")
);

-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS staging."tblRegEntry";
CREATE TABLE staging."tblRegEntry" (
    "RegdNo"       bigint,
    "Petitioner"   text,
    "Respondets"   text,
    "Adv"          text,
    "Dated"        timestamp,
    "Copies"       text,
    "District"     text,
    "RespndentNo"  text,
    "Type"         text,
    "Remark"       text,
    "AdvAddress"   text,
    "AdvMoNo"      text,
    "LongType"     text,
    "CYear"        integer
);

-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS staging."tblRegEntry1";
CREATE TABLE staging."tblRegEntry1" (
    "RegdNo"       integer,
    "Petitioner"   varchar(255),
    "Respondets"   varchar(255),
    "Adv"          varchar(255),
    "Dated"        timestamp,
    "Copies"       varchar(255),
    "District"     varchar(255),
    "RespndentNo"  varchar(255),
    "Type"         varchar(255),
    "Remark"       text,
    "AdvAddress"   text,
    "AdvMoNo"      text,
    "LongType"     text
);

-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS staging."tblRespMaster";
CREATE TABLE staging."tblRespMaster" (
    "Id"          integer NOT NULL,
    "RegdNo"      integer,
    "Respondents" text,
    "No"          text,
    "CYear"       integer,
    CONSTRAINT "PK_tblRespMaster" PRIMARY KEY ("Id")
);

-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS staging."tblType";
CREATE TABLE staging."tblType" (
    "ID"         integer NOT NULL,
    "ShortType"  text,
    "Longtype"   text,
    CONSTRAINT "PK_tblType" PRIMARY KEY ("ID")
);
