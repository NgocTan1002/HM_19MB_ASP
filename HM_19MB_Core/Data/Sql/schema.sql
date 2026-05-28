CREATE TABLE IF NOT EXISTS phien_hieu_chuan (
    id                      SERIAL          PRIMARY KEY,
    ten_thiet_bi            VARCHAR(255)    NOT NULL DEFAULT '',
    ky_hieu                 VARCHAR(100)    NOT NULL DEFAULT '',
    so_hieu                 VARCHAR(100)    NOT NULL DEFAULT '',
    so_tem                  VARCHAR(100)    NOT NULL DEFAULT '',
    noi_san_xuat            VARCHAR(255)    NOT NULL DEFAULT '',
    nam_san_xuat            VARCHAR(10)     NOT NULL DEFAULT '',
    don_vi_su_dung          VARCHAR(255)    NOT NULL DEFAULT '',
    phuong_phap             VARCHAR(255)    NOT NULL DEFAULT '',
    ngay_hieu_chuan         DATE            NOT NULL DEFAULT CURRENT_DATE,
    nhiet_do_moi_truong     VARCHAR(50)     NOT NULL DEFAULT '',
    do_am_tuong_doi        VARCHAR(50)     NOT NULL DEFAULT '',
    nhiet_do_lam_viec       VARCHAR(255)    NOT NULL DEFAULT '',
    dac_tinh_ky_thuat       TEXT            NOT NULL DEFAULT '',
    thiet_bi_chuan          TEXT            NOT NULL DEFAULT '',
    ngay_tao                TIMESTAMP       NOT NULL DEFAULT NOW()
);

ALTER TABLE phien_hieu_chuan
    ADD COLUMN IF NOT EXISTS nhiet_do_lam_viec VARCHAR(255) NOT NULL DEFAULT '';


-- ----------------------------------------------------------------

CREATE TABLE IF NOT EXISTS ket_qua_do (
    id                      SERIAL          PRIMARY KEY,
    phien_id                INT             NOT NULL
                                REFERENCES phien_hieu_chuan(id) ON DELETE CASCADE,
    thoi_gian_do            TIMESTAMP       NOT NULL,

    -- 10 đầu đo nhiệt độ
    nhiet_do_1              FLOAT           NULL,
    nhiet_do_2              FLOAT           NULL,
    nhiet_do_3              FLOAT           NULL,
    nhiet_do_4              FLOAT           NULL,
    nhiet_do_5              FLOAT           NULL,
    nhiet_do_6              FLOAT           NULL,
    nhiet_do_7              FLOAT           NULL,
    nhiet_do_8              FLOAT           NULL,
    nhiet_do_9              FLOAT           NULL,
    nhiet_do_10             FLOAT           NULL,

    -- 10 đầu đo độ ẩm (nullable — thiết bị chỉ đo nhiệt)
    do_am_1                 FLOAT           NULL,
    do_am_2                 FLOAT           NULL,
    do_am_3                 FLOAT           NULL,
    do_am_4                 FLOAT           NULL,
    do_am_5                 FLOAT           NULL,
    do_am_6                 FLOAT           NULL,
    do_am_7                 FLOAT           NULL,
    do_am_8                 FLOAT           NULL,
    do_am_9                 FLOAT           NULL,
    do_am_10                FLOAT           NULL,

    -- Kết quả tổng hợp
    nhiet_do_tb             FLOAT           NOT NULL DEFAULT 0,
    do_am_tb                FLOAT           NULL,
    do_dong_deu_nhiet       FLOAT           NOT NULL DEFAULT 0,
    do_dong_deu_am          FLOAT           NULL,
    do_on_dinh_nhiet        FLOAT           NULL,
    do_on_dinh_am           FLOAT           NULL,

    ngay_tao                TIMESTAMP       NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ket_qua_do_phien
    ON ket_qua_do(phien_id);

CREATE INDEX IF NOT EXISTS idx_ket_qua_do_thoi_gian
    ON ket_qua_do(thoi_gian_do);

ALTER TABLE ket_qua_do
    ADD COLUMN IF NOT EXISTS nhiet_do_1 FLOAT NULL,
    ADD COLUMN IF NOT EXISTS nhiet_do_2 FLOAT NULL,
    ADD COLUMN IF NOT EXISTS nhiet_do_3 FLOAT NULL,
    ADD COLUMN IF NOT EXISTS nhiet_do_4 FLOAT NULL,
    ADD COLUMN IF NOT EXISTS nhiet_do_5 FLOAT NULL,
    ADD COLUMN IF NOT EXISTS nhiet_do_6 FLOAT NULL,
    ADD COLUMN IF NOT EXISTS nhiet_do_7 FLOAT NULL,
    ADD COLUMN IF NOT EXISTS nhiet_do_8 FLOAT NULL,
    ADD COLUMN IF NOT EXISTS nhiet_do_9 FLOAT NULL,
    ADD COLUMN IF NOT EXISTS nhiet_do_10 FLOAT NULL,
    ADD COLUMN IF NOT EXISTS do_am_1 FLOAT NULL,
    ADD COLUMN IF NOT EXISTS do_am_2 FLOAT NULL,
    ADD COLUMN IF NOT EXISTS do_am_3 FLOAT NULL,
    ADD COLUMN IF NOT EXISTS do_am_4 FLOAT NULL,
    ADD COLUMN IF NOT EXISTS do_am_5 FLOAT NULL,
    ADD COLUMN IF NOT EXISTS do_am_6 FLOAT NULL,
    ADD COLUMN IF NOT EXISTS do_am_7 FLOAT NULL,
    ADD COLUMN IF NOT EXISTS do_am_8 FLOAT NULL,
    ADD COLUMN IF NOT EXISTS do_am_9 FLOAT NULL,
    ADD COLUMN IF NOT EXISTS do_am_10 FLOAT NULL,
    ADD COLUMN IF NOT EXISTS do_on_dinh_nhiet FLOAT NULL,
    ADD COLUMN IF NOT EXISTS do_on_dinh_am FLOAT NULL;


CREATE TABLE IF NOT EXISTS ket_qua_hieu_chuan (
    id                  SERIAL          PRIMARY KEY,
    phien_id            INT             NOT NULL
                            REFERENCES phien_hieu_chuan(id) ON DELETE CASCADE,

    -- Thứ tự điểm kiểm tra trong phiên (1, 2, 3, ...)
    stt                 INT             NOT NULL,

    -- Nhiệt độ cài đặt trên tủ
    gia_tri_dat         FLOAT           NOT NULL,

    -- Giá trị chỉ thị trung bình của tủ nhiệt (t̄_tn, CT3)
    gia_tri_chi_thi     FLOAT           NOT NULL,

    kenh_1              FLOAT           NULL,
    kenh_2              FLOAT           NULL,
    kenh_3              FLOAT           NULL,
    kenh_4              FLOAT           NULL,
    kenh_5              FLOAT           NULL,
    kenh_6              FLOAT           NULL,
    kenh_7              FLOAT           NULL,
    kenh_8              FLOAT           NULL,
    kenh_9              FLOAT           NULL,
    kenh_10             FLOAT           NULL,

    -- ── Kết quả tính toán tổng hợp ─────────────────────────────
    -- t̄_ch: trung bình các kênh chuẩn đã hiệu chính (CT1)
    gia_tri_trung_binh  FLOAT           NOT NULL,

    -- Δt = t̄_ch − t̄_tn (CT4) — số hiệu chính của tủ nhiệt
    so_hieu_chinh       FLOAT           NOT NULL,

    -- δt_od: độ ổn định (CT5)
    do_on_dinh          FLOAT           NOT NULL,

    -- δt_dd: độ đồng đều (CT6)
    do_dong_deu         FLOAT           NOT NULL,

    -- U: độ không đảm bảo đo mở rộng (CT19, k=2, P=95%)
    do_khong_dam_bao    FLOAT           NOT NULL,

    -- ── Thành phần trung gian (để truy vết, tái hiện tính toán)
    uch                 FLOAT           NULL,   -- liên hợp chuẩn (CT12)
    ubk                 FLOAT           NULL,   -- liên hợp tủ (CT18)

    -- ── Metadata tính toán ──────────────────────────────────────
    so_kenh             INT             NULL,   -- k: số kênh chuẩn (3/5/9/10)
    so_lan_do           INT             NULL,   -- n: số lần đọc
    phuong_phap_b       VARCHAR(10)     NULL,   -- 'U' hoặc 'Delta'

    -- ── Thông số mở rộng ────────────────────────────────────────
    do_phan_giai        FLOAT           NULL,
    he_so_phan_giai     FLOAT           NULL,
    thong_so_chuan_json TEXT            NULL,

    ngay_tao            TIMESTAMP       NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chi_tiet_lan_do (
    id              SERIAL   PRIMARY KEY,
    ket_qua_hc_id   INT      NOT NULL
                        REFERENCES ket_qua_hieu_chuan(id) ON DELETE CASCADE,
    lan_do          SMALLINT NOT NULL,   -- 1..n

    -- Chỉ thị tủ nhiệt tại lần đo này
    chi_thi_uut     FLOAT    NULL,       -- (t_tn1 + t_tn2) / 2

    -- Giá trị từng kênh chuẩn (NULL nếu không dùng)
    kenh_1          FLOAT    NULL,
    kenh_2          FLOAT    NULL,
    kenh_3          FLOAT    NULL,
    kenh_4          FLOAT    NULL,
    kenh_5          FLOAT    NULL,
    kenh_6          FLOAT    NULL,
    kenh_7          FLOAT    NULL,
    kenh_8          FLOAT    NULL,
    kenh_9          FLOAT    NULL,
    kenh_10         FLOAT    NULL
);

CREATE INDEX IF NOT EXISTS idx_kqhc_phien
    ON ket_qua_hieu_chuan(phien_id);

CREATE INDEX IF NOT EXISTS idx_kqhc_phien_stt
    ON ket_qua_hieu_chuan(phien_id, stt);


ALTER TABLE ket_qua_hieu_chuan
    DROP CONSTRAINT IF EXISTS uq_kqhc_phien_stt;

ALTER TABLE ket_qua_hieu_chuan
    ADD CONSTRAINT uq_kqhc_phien_stt UNIQUE (phien_id, stt);


ALTER TABLE ket_qua_hieu_chuan
    ADD COLUMN IF NOT EXISTS kenh_1  FLOAT NULL,
    ADD COLUMN IF NOT EXISTS kenh_2  FLOAT NULL,
    ADD COLUMN IF NOT EXISTS kenh_3  FLOAT NULL,
    ADD COLUMN IF NOT EXISTS kenh_4  FLOAT NULL,
    ADD COLUMN IF NOT EXISTS kenh_5  FLOAT NULL,
    ADD COLUMN IF NOT EXISTS kenh_6  FLOAT NULL,
    ADD COLUMN IF NOT EXISTS kenh_7  FLOAT NULL,
    ADD COLUMN IF NOT EXISTS kenh_8  FLOAT NULL,
    ADD COLUMN IF NOT EXISTS kenh_9  FLOAT NULL,
    ADD COLUMN IF NOT EXISTS kenh_10 FLOAT NULL,
    ADD COLUMN IF NOT EXISTS do_phan_giai FLOAT NULL,
    ADD COLUMN IF NOT EXISTS he_so_phan_giai FLOAT NULL,
    ADD COLUMN IF NOT EXISTS thong_so_chuan_json TEXT NULL;


-- ── Migration v7: đảm bảo chi_tiet_lan_do denormalized (kenh_1..10) ──
-- Nếu bảng cũ dùng cấu trúc normalized (kenh + gia_tri) thì tạo lại
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'chi_tiet_lan_do' AND column_name = 'gia_tri'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'chi_tiet_lan_do' AND column_name = 'kenh_1'
    ) THEN
        DROP TABLE chi_tiet_lan_do CASCADE;

        CREATE TABLE chi_tiet_lan_do (
            id              SERIAL   PRIMARY KEY,
            ket_qua_hc_id   INT      NOT NULL
                                REFERENCES ket_qua_hieu_chuan(id) ON DELETE CASCADE,
            lan_do          SMALLINT NOT NULL,
            chi_thi_uut     FLOAT    NULL,
            kenh_1  FLOAT NULL, kenh_2  FLOAT NULL, kenh_3  FLOAT NULL,
            kenh_4  FLOAT NULL, kenh_5  FLOAT NULL, kenh_6  FLOAT NULL,
            kenh_7  FLOAT NULL, kenh_8  FLOAT NULL, kenh_9  FLOAT NULL,
            kenh_10 FLOAT NULL
        );

        RAISE NOTICE 'Migrated chi_tiet_lan_do to denormalized (kenh_1..10)';
    END IF;
END;
$$;

-- Đảm bảo các cột kenh_1..10 tồn tại (cho DB cũ chưa có)
ALTER TABLE chi_tiet_lan_do
    ADD COLUMN IF NOT EXISTS chi_thi_uut FLOAT NULL,
    ADD COLUMN IF NOT EXISTS kenh_1  FLOAT NULL,
    ADD COLUMN IF NOT EXISTS kenh_2  FLOAT NULL,
    ADD COLUMN IF NOT EXISTS kenh_3  FLOAT NULL,
    ADD COLUMN IF NOT EXISTS kenh_4  FLOAT NULL,
    ADD COLUMN IF NOT EXISTS kenh_5  FLOAT NULL,
    ADD COLUMN IF NOT EXISTS kenh_6  FLOAT NULL,
    ADD COLUMN IF NOT EXISTS kenh_7  FLOAT NULL,
    ADD COLUMN IF NOT EXISTS kenh_8  FLOAT NULL,
    ADD COLUMN IF NOT EXISTS kenh_9  FLOAT NULL,
    ADD COLUMN IF NOT EXISTS kenh_10 FLOAT NULL;

ALTER TABLE chi_tiet_lan_do
    DROP CONSTRAINT IF EXISTS uq_ctld_hc_lan;

ALTER TABLE chi_tiet_lan_do
    ADD CONSTRAINT uq_ctld_hc_lan
        UNIQUE (ket_qua_hc_id, lan_do);

