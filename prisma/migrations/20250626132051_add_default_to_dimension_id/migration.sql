-- AlterTable
CREATE SEQUENCE dimension_id_seq;
ALTER TABLE "Dimension" ALTER COLUMN "id" SET DEFAULT nextval('dimension_id_seq');
ALTER SEQUENCE dimension_id_seq OWNED BY "Dimension"."id";
