-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('super_admin', 'admin', 'end_user');

-- CreateEnum
CREATE TYPE "Category" AS ENUM ('A', 'B', 'C', 'D');

-- CreateEnum
CREATE TYPE "McdmMode" AS ENUM ('profil', 'preferensi');

-- CreateEnum
CREATE TYPE "CriteriaType" AS ENUM ('benefit', 'cost');

-- CreateEnum
CREATE TYPE "FuzzyVariableType" AS ENUM ('input', 'output');

-- CreateEnum
CREATE TYPE "MembershipFunction" AS ENUM ('linear_naik', 'linear_turun', 'segitiga', 'trapesium');

-- CreateEnum
CREATE TYPE "LogicOperator" AS ENUM ('AND', 'OR');

-- CreateEnum
CREATE TYPE "ValidationStatus" AS ENUM ('match', 'mismatch');

-- CreateTable
CREATE TABLE "clients" (
    "id" SERIAL NOT NULL,
    "nama_client" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "deskripsi" TEXT,
    "logo_url" VARCHAR(500),
    "warna_primary" VARCHAR(9) NOT NULL DEFAULT '#0f766e',
    "warna_secondary" VARCHAR(9) NOT NULL DEFAULT '#134e4a',
    "warna_accent" VARCHAR(9) NOT NULL DEFAULT '#f59e0b',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "client_id" INTEGER,
    "role" "Role" NOT NULL,
    "nama" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "spk_cases" (
    "id" SERIAL NOT NULL,
    "client_id" INTEGER NOT NULL,
    "judul" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "deskripsi" TEXT,
    "instruksi" TEXT,
    "gambar_url" VARCHAR(500),
    "method_key" VARCHAR(40) NOT NULL,
    "category" "Category" NOT NULL,
    "mcdm_mode" "McdmMode" NOT NULL DEFAULT 'profil',
    "requires_login" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "spk_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alternatives" (
    "id" SERIAL NOT NULL,
    "client_id" INTEGER NOT NULL,
    "case_id" INTEGER NOT NULL,
    "nama_alternatif" TEXT NOT NULL,
    "deskripsi_hasil" TEXT,
    "saran_tindakan" TEXT,
    "prior" DOUBLE PRECISION,
    "urutan" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "alternatives_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consultations" (
    "id" SERIAL NOT NULL,
    "kode" VARCHAR(24) NOT NULL,
    "client_id" INTEGER NOT NULL,
    "case_id" INTEGER NOT NULL,
    "user_id" INTEGER,
    "session_id" VARCHAR(64),
    "method_key" VARCHAR(40) NOT NULL,
    "nama_responden" TEXT,
    "input_data_json" JSONB NOT NULL,
    "hasil_json" JSONB NOT NULL,
    "hasil_alternative_id" INTEGER,
    "skor" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consultations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calculation_steps" (
    "id" SERIAL NOT NULL,
    "client_id" INTEGER NOT NULL,
    "consultation_id" INTEGER NOT NULL,
    "langkah_ke" INTEGER NOT NULL,
    "judul_langkah" TEXT NOT NULL,
    "detail_json" JSONB NOT NULL,
    "rumus_text" TEXT,

    CONSTRAINT "calculation_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "validation_tests" (
    "id" SERIAL NOT NULL,
    "client_id" INTEGER NOT NULL,
    "case_id" INTEGER NOT NULL,
    "nama_dataset_uji" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_run_at" TIMESTAMP(3),
    "last_run_method" VARCHAR(40),

    CONSTRAINT "validation_tests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "validation_test_items" (
    "id" SERIAL NOT NULL,
    "client_id" INTEGER NOT NULL,
    "validation_test_id" INTEGER NOT NULL,
    "label" TEXT,
    "input_data_json" JSONB NOT NULL,
    "diagnosis_pakar_alternative_id" INTEGER NOT NULL,
    "hasil_sistem_alternative_id" INTEGER,
    "skor" DOUBLE PRECISION,
    "status" "ValidationStatus",
    "catatan" TEXT,

    CONSTRAINT "validation_test_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_limits" (
    "key" VARCHAR(200) NOT NULL,
    "jumlah" INTEGER NOT NULL DEFAULT 0,
    "reset_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rate_limits_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "system_settings" (
    "key" VARCHAR(64) NOT NULL,
    "value" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "criteria_mcdm" (
    "id" SERIAL NOT NULL,
    "client_id" INTEGER NOT NULL,
    "case_id" INTEGER NOT NULL,
    "nama_kriteria" TEXT NOT NULL,
    "pertanyaan" TEXT,
    "tipe" "CriteriaType" NOT NULL DEFAULT 'benefit',
    "bobot" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "urutan" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "criteria_mcdm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "criteria_scale_mcdm" (
    "id" SERIAL NOT NULL,
    "client_id" INTEGER NOT NULL,
    "criteria_id" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "nilai" DOUBLE PRECISION NOT NULL,
    "urutan" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "criteria_scale_mcdm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alternative_values_mcdm" (
    "id" SERIAL NOT NULL,
    "client_id" INTEGER NOT NULL,
    "alternative_id" INTEGER NOT NULL,
    "criteria_id" INTEGER NOT NULL,
    "nilai" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "alternative_values_mcdm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ahp_pairwise" (
    "id" SERIAL NOT NULL,
    "client_id" INTEGER NOT NULL,
    "case_id" INTEGER NOT NULL,
    "criteria_id_a" INTEGER NOT NULL,
    "criteria_id_b" INTEGER NOT NULL,
    "nilai_perbandingan" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "ahp_pairwise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "symptoms" (
    "id" SERIAL NOT NULL,
    "client_id" INTEGER NOT NULL,
    "case_id" INTEGER NOT NULL,
    "nama_gejala" VARCHAR(500) NOT NULL,
    "kode_gejala" VARCHAR(20) NOT NULL,
    "urutan" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "symptoms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alternative_symptom_weight" (
    "id" SERIAL NOT NULL,
    "client_id" INTEGER NOT NULL,
    "alternative_id" INTEGER NOT NULL,
    "symptom_id" INTEGER NOT NULL,
    "nilai_pakar" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "alternative_symptom_weight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conditional_dependency" (
    "id" SERIAL NOT NULL,
    "client_id" INTEGER NOT NULL,
    "case_id" INTEGER NOT NULL,
    "symptom_id_child" INTEGER NOT NULL,
    "symptom_id_parent" INTEGER NOT NULL,
    "probabilitas" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "conditional_dependency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fuzzy_variables" (
    "id" SERIAL NOT NULL,
    "client_id" INTEGER NOT NULL,
    "case_id" INTEGER NOT NULL,
    "nama_variabel" TEXT NOT NULL,
    "tipe" "FuzzyVariableType" NOT NULL,
    "satuan" VARCHAR(50),
    "nilai_min" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "nilai_max" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "urutan" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "fuzzy_variables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fuzzy_sets" (
    "id" SERIAL NOT NULL,
    "client_id" INTEGER NOT NULL,
    "variable_id" INTEGER NOT NULL,
    "nama_himpunan" TEXT NOT NULL,
    "fungsi_keanggotaan" "MembershipFunction" NOT NULL,
    "parameter_json" JSONB NOT NULL,
    "urutan" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "fuzzy_sets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fuzzy_rules" (
    "id" SERIAL NOT NULL,
    "client_id" INTEGER NOT NULL,
    "case_id" INTEGER NOT NULL,
    "alternative_id" INTEGER,
    "rule_text" TEXT NOT NULL,
    "anteseden_json" JSONB NOT NULL,
    "konsekuen_json" JSONB NOT NULL,
    "urutan" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "fuzzy_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rules_chaining" (
    "id" SERIAL NOT NULL,
    "client_id" INTEGER NOT NULL,
    "case_id" INTEGER NOT NULL,
    "alternative_id" INTEGER NOT NULL,
    "nama_rule" TEXT NOT NULL,
    "urutan" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "rules_chaining_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rule_conditions" (
    "id" SERIAL NOT NULL,
    "client_id" INTEGER NOT NULL,
    "rule_id" INTEGER NOT NULL,
    "symptom_id" INTEGER NOT NULL,
    "operator" "LogicOperator" NOT NULL DEFAULT 'AND',
    "urutan" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "rule_conditions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "clients_slug_key" ON "clients"("slug");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_client_id_email_key" ON "users"("client_id", "email");

-- CreateIndex
CREATE UNIQUE INDEX "spk_cases_client_id_slug_key" ON "spk_cases"("client_id", "slug");

-- CreateIndex
CREATE INDEX "alternatives_case_id_urutan_idx" ON "alternatives"("case_id", "urutan");

-- CreateIndex
CREATE UNIQUE INDEX "consultations_kode_key" ON "consultations"("kode");

-- CreateIndex
CREATE INDEX "consultations_case_id_created_at_idx" ON "consultations"("case_id", "created_at");

-- CreateIndex
CREATE INDEX "consultations_user_id_idx" ON "consultations"("user_id");

-- CreateIndex
CREATE INDEX "consultations_session_id_idx" ON "consultations"("session_id");

-- CreateIndex
CREATE INDEX "calculation_steps_consultation_id_langkah_ke_idx" ON "calculation_steps"("consultation_id", "langkah_ke");

-- CreateIndex
CREATE INDEX "validation_tests_case_id_idx" ON "validation_tests"("case_id");

-- CreateIndex
CREATE INDEX "validation_test_items_validation_test_id_idx" ON "validation_test_items"("validation_test_id");

-- CreateIndex
CREATE INDEX "rate_limits_reset_at_idx" ON "rate_limits"("reset_at");

-- CreateIndex
CREATE INDEX "criteria_mcdm_case_id_urutan_idx" ON "criteria_mcdm"("case_id", "urutan");

-- CreateIndex
CREATE INDEX "criteria_scale_mcdm_criteria_id_urutan_idx" ON "criteria_scale_mcdm"("criteria_id", "urutan");

-- CreateIndex
CREATE UNIQUE INDEX "alternative_values_mcdm_alternative_id_criteria_id_key" ON "alternative_values_mcdm"("alternative_id", "criteria_id");

-- CreateIndex
CREATE INDEX "ahp_pairwise_case_id_idx" ON "ahp_pairwise"("case_id");

-- CreateIndex
CREATE UNIQUE INDEX "ahp_pairwise_criteria_id_a_criteria_id_b_key" ON "ahp_pairwise"("criteria_id_a", "criteria_id_b");

-- CreateIndex
CREATE INDEX "symptoms_case_id_urutan_idx" ON "symptoms"("case_id", "urutan");

-- CreateIndex
CREATE UNIQUE INDEX "symptoms_case_id_kode_gejala_key" ON "symptoms"("case_id", "kode_gejala");

-- CreateIndex
CREATE UNIQUE INDEX "alternative_symptom_weight_alternative_id_symptom_id_key" ON "alternative_symptom_weight"("alternative_id", "symptom_id");

-- CreateIndex
CREATE INDEX "conditional_dependency_case_id_idx" ON "conditional_dependency"("case_id");

-- CreateIndex
CREATE UNIQUE INDEX "conditional_dependency_symptom_id_child_symptom_id_parent_key" ON "conditional_dependency"("symptom_id_child", "symptom_id_parent");

-- CreateIndex
CREATE INDEX "fuzzy_variables_case_id_urutan_idx" ON "fuzzy_variables"("case_id", "urutan");

-- CreateIndex
CREATE INDEX "fuzzy_sets_variable_id_urutan_idx" ON "fuzzy_sets"("variable_id", "urutan");

-- CreateIndex
CREATE INDEX "fuzzy_rules_case_id_urutan_idx" ON "fuzzy_rules"("case_id", "urutan");

-- CreateIndex
CREATE INDEX "rules_chaining_case_id_urutan_idx" ON "rules_chaining"("case_id", "urutan");

-- CreateIndex
CREATE INDEX "rule_conditions_rule_id_urutan_idx" ON "rule_conditions"("rule_id", "urutan");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spk_cases" ADD CONSTRAINT "spk_cases_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alternatives" ADD CONSTRAINT "alternatives_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alternatives" ADD CONSTRAINT "alternatives_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "spk_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultations" ADD CONSTRAINT "consultations_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultations" ADD CONSTRAINT "consultations_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "spk_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultations" ADD CONSTRAINT "consultations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultations" ADD CONSTRAINT "consultations_hasil_alternative_id_fkey" FOREIGN KEY ("hasil_alternative_id") REFERENCES "alternatives"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calculation_steps" ADD CONSTRAINT "calculation_steps_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calculation_steps" ADD CONSTRAINT "calculation_steps_consultation_id_fkey" FOREIGN KEY ("consultation_id") REFERENCES "consultations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "validation_tests" ADD CONSTRAINT "validation_tests_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "validation_tests" ADD CONSTRAINT "validation_tests_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "spk_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "validation_test_items" ADD CONSTRAINT "validation_test_items_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "validation_test_items" ADD CONSTRAINT "validation_test_items_validation_test_id_fkey" FOREIGN KEY ("validation_test_id") REFERENCES "validation_tests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "validation_test_items" ADD CONSTRAINT "validation_test_items_diagnosis_pakar_alternative_id_fkey" FOREIGN KEY ("diagnosis_pakar_alternative_id") REFERENCES "alternatives"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "validation_test_items" ADD CONSTRAINT "validation_test_items_hasil_sistem_alternative_id_fkey" FOREIGN KEY ("hasil_sistem_alternative_id") REFERENCES "alternatives"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "criteria_mcdm" ADD CONSTRAINT "criteria_mcdm_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "criteria_mcdm" ADD CONSTRAINT "criteria_mcdm_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "spk_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "criteria_scale_mcdm" ADD CONSTRAINT "criteria_scale_mcdm_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "criteria_scale_mcdm" ADD CONSTRAINT "criteria_scale_mcdm_criteria_id_fkey" FOREIGN KEY ("criteria_id") REFERENCES "criteria_mcdm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alternative_values_mcdm" ADD CONSTRAINT "alternative_values_mcdm_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alternative_values_mcdm" ADD CONSTRAINT "alternative_values_mcdm_alternative_id_fkey" FOREIGN KEY ("alternative_id") REFERENCES "alternatives"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alternative_values_mcdm" ADD CONSTRAINT "alternative_values_mcdm_criteria_id_fkey" FOREIGN KEY ("criteria_id") REFERENCES "criteria_mcdm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ahp_pairwise" ADD CONSTRAINT "ahp_pairwise_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ahp_pairwise" ADD CONSTRAINT "ahp_pairwise_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "spk_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ahp_pairwise" ADD CONSTRAINT "ahp_pairwise_criteria_id_a_fkey" FOREIGN KEY ("criteria_id_a") REFERENCES "criteria_mcdm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ahp_pairwise" ADD CONSTRAINT "ahp_pairwise_criteria_id_b_fkey" FOREIGN KEY ("criteria_id_b") REFERENCES "criteria_mcdm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "symptoms" ADD CONSTRAINT "symptoms_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "symptoms" ADD CONSTRAINT "symptoms_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "spk_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alternative_symptom_weight" ADD CONSTRAINT "alternative_symptom_weight_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alternative_symptom_weight" ADD CONSTRAINT "alternative_symptom_weight_alternative_id_fkey" FOREIGN KEY ("alternative_id") REFERENCES "alternatives"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alternative_symptom_weight" ADD CONSTRAINT "alternative_symptom_weight_symptom_id_fkey" FOREIGN KEY ("symptom_id") REFERENCES "symptoms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conditional_dependency" ADD CONSTRAINT "conditional_dependency_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conditional_dependency" ADD CONSTRAINT "conditional_dependency_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "spk_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conditional_dependency" ADD CONSTRAINT "conditional_dependency_symptom_id_child_fkey" FOREIGN KEY ("symptom_id_child") REFERENCES "symptoms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conditional_dependency" ADD CONSTRAINT "conditional_dependency_symptom_id_parent_fkey" FOREIGN KEY ("symptom_id_parent") REFERENCES "symptoms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fuzzy_variables" ADD CONSTRAINT "fuzzy_variables_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fuzzy_variables" ADD CONSTRAINT "fuzzy_variables_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "spk_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fuzzy_sets" ADD CONSTRAINT "fuzzy_sets_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fuzzy_sets" ADD CONSTRAINT "fuzzy_sets_variable_id_fkey" FOREIGN KEY ("variable_id") REFERENCES "fuzzy_variables"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fuzzy_rules" ADD CONSTRAINT "fuzzy_rules_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fuzzy_rules" ADD CONSTRAINT "fuzzy_rules_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "spk_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fuzzy_rules" ADD CONSTRAINT "fuzzy_rules_alternative_id_fkey" FOREIGN KEY ("alternative_id") REFERENCES "alternatives"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rules_chaining" ADD CONSTRAINT "rules_chaining_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rules_chaining" ADD CONSTRAINT "rules_chaining_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "spk_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rules_chaining" ADD CONSTRAINT "rules_chaining_alternative_id_fkey" FOREIGN KEY ("alternative_id") REFERENCES "alternatives"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rule_conditions" ADD CONSTRAINT "rule_conditions_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rule_conditions" ADD CONSTRAINT "rule_conditions_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "rules_chaining"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rule_conditions" ADD CONSTRAINT "rule_conditions_symptom_id_fkey" FOREIGN KEY ("symptom_id") REFERENCES "symptoms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

