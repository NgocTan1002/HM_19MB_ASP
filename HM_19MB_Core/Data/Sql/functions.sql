CREATE OR REPLACE FUNCTION fn_tao_phien(
    p_ten_thiet_bi          VARCHAR,
    p_ky_hieu               VARCHAR,
    p_so_hieu               VARCHAR,
    p_so_tem                VARCHAR,
    p_noi_san_xuat          VARCHAR,
    p_nam_san_xuat          VARCHAR,
    p_don_vi_su_dung        VARCHAR,
    p_phuong_phap           VARCHAR,
    p_ngay_hieu_chuan       DATE,
    p_nhiet_do_moi_truong   VARCHAR,
    p_do_am_tuong_doi      VARCHAR,
    p_nhiet_do_lam_viec     VARCHAR,
    p_dac_tinh_ky_thuat     TEXT,
    p_thiet_bi_chuan        TEXT
)
RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE
    v_id INT;
BEGIN
    INSERT INTO phien_hieu_chuan (
        ten_thiet_bi, ky_hieu, so_hieu, so_tem,
        noi_san_xuat, nam_san_xuat, don_vi_su_dung, phuong_phap,
        ngay_hieu_chuan,
        nhiet_do_moi_truong, do_am_tuong_doi, nhiet_do_lam_viec,
        dac_tinh_ky_thuat, thiet_bi_chuan
    )
    VALUES (
        p_ten_thiet_bi, p_ky_hieu, p_so_hieu, p_so_tem,
        p_noi_san_xuat, p_nam_san_xuat, p_don_vi_su_dung, p_phuong_phap,
        p_ngay_hieu_chuan,
        p_nhiet_do_moi_truong, p_do_am_tuong_doi, p_nhiet_do_lam_viec,
        p_dac_tinh_ky_thuat, p_thiet_bi_chuan
    )
    RETURNING id INTO v_id;

    RETURN v_id;
END;
$$;


-- Xoá signature cũ (v4/v5) nếu tồn tại
DROP FUNCTION IF EXISTS fn_luu_ket_qua_hieu_chuan(
    INT, INT, FLOAT, FLOAT,
    FLOAT, FLOAT, FLOAT, FLOAT, FLOAT, FLOAT, FLOAT, FLOAT, FLOAT, FLOAT,
    FLOAT, FLOAT, FLOAT, FLOAT, FLOAT,
    FLOAT, FLOAT, FLOAT, FLOAT, FLOAT, FLOAT, FLOAT, FLOAT,
    INT, INT, VARCHAR
);
 
CREATE OR REPLACE FUNCTION fn_luu_ket_qua_hieu_chuan(
    -- Khoá
    p_phien_id              INT,
    p_stt                   INT,
 
    -- Người dùng nhập
    p_gia_tri_dat           FLOAT,
    p_gia_tri_chi_thi       FLOAT,
 
    -- Giá trị trung bình từng kênh chuẩn (NULL nếu không dùng)
    p_kenh_1                FLOAT,
    p_kenh_2                FLOAT,
    p_kenh_3                FLOAT,
    p_kenh_4                FLOAT,
    p_kenh_5                FLOAT,
    p_kenh_6                FLOAT,
    p_kenh_7                FLOAT,
    p_kenh_8                FLOAT,
    p_kenh_9                FLOAT,
    p_kenh_10               FLOAT,
 
    -- Kết quả tổng hợp
    p_gia_tri_trung_binh    FLOAT,
    p_so_hieu_chinh         FLOAT,
    p_do_on_dinh            FLOAT,
    p_do_dong_deu           FLOAT,
    p_do_khong_dam_bao      FLOAT,
 
    -- Chỉ giữ giá trị TỔNG HỢP (bỏ ubk1..ubk4, uch1, uch2)
    p_uch                   FLOAT,
    p_ubk                   FLOAT,
 
    -- Metadata tính toán
    p_so_kenh               INT,
    p_so_lan_do             INT,
    p_phuong_phap_b         VARCHAR,

    -- Thông số mở rộng
    p_do_phan_giai          FLOAT,
    p_he_so_phan_giai       FLOAT,
    p_thong_so_chuan_json   TEXT
)
RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE
    v_id INT;
BEGIN
    INSERT INTO ket_qua_hieu_chuan (
        phien_id, stt,
        gia_tri_dat, gia_tri_chi_thi,
        kenh_1, kenh_2, kenh_3, kenh_4, kenh_5,
        kenh_6, kenh_7, kenh_8, kenh_9, kenh_10,
        gia_tri_trung_binh, so_hieu_chinh,
        do_on_dinh, do_dong_deu, do_khong_dam_bao,
        uch, ubk,
        so_kenh, so_lan_do, phuong_phap_b,
        do_phan_giai, he_so_phan_giai, thong_so_chuan_json
    )
    VALUES (
        p_phien_id, p_stt,
        p_gia_tri_dat, p_gia_tri_chi_thi,
        p_kenh_1, p_kenh_2, p_kenh_3, p_kenh_4, p_kenh_5,
        p_kenh_6, p_kenh_7, p_kenh_8, p_kenh_9, p_kenh_10,
        p_gia_tri_trung_binh, p_so_hieu_chinh,
        p_do_on_dinh, p_do_dong_deu, p_do_khong_dam_bao,
        p_uch, p_ubk,
        p_so_kenh, p_so_lan_do, p_phuong_phap_b,
        p_do_phan_giai, p_he_so_phan_giai, p_thong_so_chuan_json
    )
    ON CONFLICT (phien_id, stt) DO UPDATE SET
        gia_tri_dat          = EXCLUDED.gia_tri_dat,
        gia_tri_chi_thi      = EXCLUDED.gia_tri_chi_thi,
        kenh_1               = EXCLUDED.kenh_1,
        kenh_2               = EXCLUDED.kenh_2,
        kenh_3               = EXCLUDED.kenh_3,
        kenh_4               = EXCLUDED.kenh_4,
        kenh_5               = EXCLUDED.kenh_5,
        kenh_6               = EXCLUDED.kenh_6,
        kenh_7               = EXCLUDED.kenh_7,
        kenh_8               = EXCLUDED.kenh_8,
        kenh_9               = EXCLUDED.kenh_9,
        kenh_10              = EXCLUDED.kenh_10,
        gia_tri_trung_binh   = EXCLUDED.gia_tri_trung_binh,
        so_hieu_chinh        = EXCLUDED.so_hieu_chinh,
        do_on_dinh           = EXCLUDED.do_on_dinh,
        do_dong_deu          = EXCLUDED.do_dong_deu,
        do_khong_dam_bao     = EXCLUDED.do_khong_dam_bao,
        uch                  = EXCLUDED.uch,
        ubk                  = EXCLUDED.ubk,
        so_kenh              = EXCLUDED.so_kenh,
        so_lan_do            = EXCLUDED.so_lan_do,
        phuong_phap_b        = EXCLUDED.phuong_phap_b,
        do_phan_giai         = EXCLUDED.do_phan_giai,
        he_so_phan_giai      = EXCLUDED.he_so_phan_giai,
        thong_so_chuan_json  = EXCLUDED.thong_so_chuan_json,
        ngay_tao             = NOW()
    RETURNING id INTO v_id;
 
    RETURN v_id;
END;
$$;


-- ----------------------------------------------------------------
-- fn_luu_ket_qua_do: Lưu 1 block đo (tổng hợp + toàn bộ đầu đo)
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_luu_ket_qua_do(
    p_phien_id          INT,
    p_thoi_gian_do      TIMESTAMP,
    p_nhiet_do          FLOAT[],
    p_do_am             FLOAT[],
    p_nhiet_do_tb       FLOAT,
    p_do_am_tb          FLOAT,
    p_do_dong_deu_nhiet FLOAT,
    p_do_dong_deu_am    FLOAT,
    p_do_on_dinh_nhiet  FLOAT,
    p_do_on_dinh_am     FLOAT
)
RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE
    v_id INT;
BEGIN
    INSERT INTO ket_qua_do (
        phien_id, thoi_gian_do,
        nhiet_do_1, nhiet_do_2, nhiet_do_3, nhiet_do_4, nhiet_do_5,
        nhiet_do_6, nhiet_do_7, nhiet_do_8, nhiet_do_9, nhiet_do_10,
        do_am_1, do_am_2, do_am_3, do_am_4, do_am_5,
        do_am_6, do_am_7, do_am_8, do_am_9, do_am_10,
        nhiet_do_tb, do_am_tb,
        do_dong_deu_nhiet, do_dong_deu_am,
        do_on_dinh_nhiet, do_on_dinh_am
    )
    VALUES (
        p_phien_id, p_thoi_gian_do,
        p_nhiet_do[1], p_nhiet_do[2], p_nhiet_do[3], p_nhiet_do[4], p_nhiet_do[5],
        p_nhiet_do[6], p_nhiet_do[7], p_nhiet_do[8], p_nhiet_do[9], p_nhiet_do[10],
        p_do_am[1], p_do_am[2], p_do_am[3], p_do_am[4], p_do_am[5],
        p_do_am[6], p_do_am[7], p_do_am[8], p_do_am[9], p_do_am[10],
        p_nhiet_do_tb, p_do_am_tb,
        p_do_dong_deu_nhiet, p_do_dong_deu_am,
        p_do_on_dinh_nhiet, p_do_on_dinh_am
    )
    RETURNING id INTO v_id;

    RETURN v_id;
END;
$$;


CREATE OR REPLACE FUNCTION fn_lay_phien(p_phien_id INT)
RETURNS TABLE (
    ten_thiet_bi            VARCHAR,
    ky_hieu                 VARCHAR,
    so_hieu                 VARCHAR,
    so_tem                  VARCHAR,
    noi_san_xuat            VARCHAR,
    nam_san_xuat            VARCHAR,
    don_vi_su_dung          VARCHAR,
    phuong_phap             VARCHAR,
    ngay_hieu_chuan         DATE,
    nhiet_do_moi_truong     VARCHAR,
    do_am_tuong_doi        VARCHAR,
    nhiet_do_lam_viec       VARCHAR,
    dac_tinh_ky_thuat       TEXT,
    thiet_bi_chuan          TEXT
)
LANGUAGE sql
STABLE
AS $$
    SELECT
        ten_thiet_bi, ky_hieu, so_hieu, so_tem,
        noi_san_xuat, nam_san_xuat, don_vi_su_dung, phuong_phap,
        ngay_hieu_chuan,
        nhiet_do_moi_truong, do_am_tuong_doi, nhiet_do_lam_viec,
        dac_tinh_ky_thuat, thiet_bi_chuan
    FROM phien_hieu_chuan
    WHERE id = p_phien_id;
$$;


DROP FUNCTION IF EXISTS fn_lay_ket_qua_theo_phien(INT);

CREATE OR REPLACE FUNCTION fn_lay_ket_qua_theo_phien(p_phien_id INT)
RETURNS TABLE (
    ket_qua_id              INT,
    thoi_gian_do            TIMESTAMP,
    nhiet_do_1              FLOAT,
    nhiet_do_2              FLOAT,
    nhiet_do_3              FLOAT,
    nhiet_do_4              FLOAT,
    nhiet_do_5              FLOAT,
    nhiet_do_6              FLOAT,
    nhiet_do_7              FLOAT,
    nhiet_do_8              FLOAT,
    nhiet_do_9              FLOAT,
    nhiet_do_10             FLOAT,
    do_am_1                 FLOAT,
    do_am_2                 FLOAT,
    do_am_3                 FLOAT,
    do_am_4                 FLOAT,
    do_am_5                 FLOAT,
    do_am_6                 FLOAT,
    do_am_7                 FLOAT,
    do_am_8                 FLOAT,
    do_am_9                 FLOAT,
    do_am_10                FLOAT,
    nhiet_do_tb             FLOAT,
    do_am_tb                FLOAT,
    do_dong_deu_nhiet       FLOAT,
    do_dong_deu_am          FLOAT,
    do_on_dinh_nhiet        FLOAT,
    do_on_dinh_am           FLOAT
)
LANGUAGE sql
STABLE
AS $$
    SELECT
        kq.id,
        kq.thoi_gian_do,
        kq.nhiet_do_1,
        kq.nhiet_do_2,
        kq.nhiet_do_3,
        kq.nhiet_do_4,
        kq.nhiet_do_5,
        kq.nhiet_do_6,
        kq.nhiet_do_7,
        kq.nhiet_do_8,
        kq.nhiet_do_9,
        kq.nhiet_do_10,
        kq.do_am_1,
        kq.do_am_2,
        kq.do_am_3,
        kq.do_am_4,
        kq.do_am_5,
        kq.do_am_6,
        kq.do_am_7,
        kq.do_am_8,
        kq.do_am_9,
        kq.do_am_10,
        kq.nhiet_do_tb,
        kq.do_am_tb,
        kq.do_dong_deu_nhiet,
        kq.do_dong_deu_am,
        kq.do_on_dinh_nhiet,
        kq.do_on_dinh_am
    FROM ket_qua_do kq
    WHERE kq.phien_id = p_phien_id
    ORDER BY kq.thoi_gian_do, kq.id;
$$;





-- ----------------------------------------------------------------
-- fn_lay_ket_qua_hieu_chuan
-- ----------------------------------------------------------------
DROP FUNCTION IF EXISTS fn_lay_ket_qua_hieu_chuan(INT);
 
CREATE OR REPLACE FUNCTION fn_lay_ket_qua_hieu_chuan(p_phien_id INT)
RETURNS TABLE (
    id                  INT,
    stt                 INT,
    gia_tri_dat         FLOAT,
    gia_tri_chi_thi     FLOAT,
    kenh_1              FLOAT,
    kenh_2              FLOAT,
    kenh_3              FLOAT,
    kenh_4              FLOAT,
    kenh_5              FLOAT,
    kenh_6              FLOAT,
    kenh_7              FLOAT,
    kenh_8              FLOAT,
    kenh_9              FLOAT,
    kenh_10             FLOAT,
    gia_tri_trung_binh  FLOAT,
    so_hieu_chinh       FLOAT,
    do_on_dinh          FLOAT,
    do_dong_deu         FLOAT,
    do_khong_dam_bao    FLOAT,
    uch                 FLOAT,
    ubk                 FLOAT,
    so_kenh             INT,
    so_lan_do           INT,
    phuong_phap_b       VARCHAR,
    do_phan_giai        FLOAT,
    he_so_phan_giai     FLOAT,
    thong_so_chuan_json TEXT
)
LANGUAGE sql STABLE AS $$
    SELECT
        id, stt,
        gia_tri_dat, gia_tri_chi_thi,
        kenh_1, kenh_2, kenh_3, kenh_4, kenh_5,
        kenh_6, kenh_7, kenh_8, kenh_9, kenh_10,
        gia_tri_trung_binh, so_hieu_chinh,
        do_on_dinh, do_dong_deu, do_khong_dam_bao,
        uch, ubk,
        so_kenh, so_lan_do, phuong_phap_b,
        do_phan_giai, he_so_phan_giai, thong_so_chuan_json
    FROM ket_qua_hieu_chuan
    WHERE phien_id = p_phien_id
    ORDER BY stt;
$$;


-- ----------------------------------------------------------------
-- fn_xoa_ket_qua_hieu_chuan
-- ----------------------------------------------------------------
DROP FUNCTION IF EXISTS fn_xoa_ket_qua_hieu_chuan(INT, INT);

CREATE OR REPLACE FUNCTION fn_xoa_ket_qua_hieu_chuan(
    p_phien_id  INT,
    p_stt       INT
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    DELETE FROM ket_qua_hieu_chuan
    WHERE phien_id = p_phien_id AND stt = p_stt;

    -- Cập nhật lại stt cho các dòng phía sau để liên tục
    UPDATE ket_qua_hieu_chuan
    SET stt = stt - 1
    WHERE phien_id = p_phien_id AND stt > p_stt;
END;
$$;


-- ----------------------------------------------------------------
-- fn_lay_stt_tiep_theo
-- ----------------------------------------------------------------
DROP FUNCTION IF EXISTS fn_lay_stt_tiep_theo(INT);

CREATE OR REPLACE FUNCTION fn_lay_stt_tiep_theo(p_phien_id INT)
RETURNS INT
LANGUAGE sql
AS $$
    SELECT COALESCE(MAX(stt), 0) + 1
    FROM ket_qua_hieu_chuan
    WHERE phien_id = p_phien_id;
$$;


-- Lưu 1 lần đo (upsert — 1 dòng = 1 lan_do với kenh_1..10)
CREATE OR REPLACE FUNCTION fn_luu_chi_tiet_lan_do(
    p_ket_qua_hc_id INT,
    p_lan_do        SMALLINT,
    p_chi_thi_uut   FLOAT,
    p_kenh_1        FLOAT,
    p_kenh_2        FLOAT,
    p_kenh_3        FLOAT,
    p_kenh_4        FLOAT,
    p_kenh_5        FLOAT,
    p_kenh_6        FLOAT,
    p_kenh_7        FLOAT,
    p_kenh_8        FLOAT,
    p_kenh_9        FLOAT,
    p_kenh_10       FLOAT
)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO chi_tiet_lan_do
        (ket_qua_hc_id, lan_do, chi_thi_uut,
         kenh_1, kenh_2, kenh_3, kenh_4, kenh_5,
         kenh_6, kenh_7, kenh_8, kenh_9, kenh_10)
    VALUES
        (p_ket_qua_hc_id, p_lan_do, p_chi_thi_uut,
         p_kenh_1, p_kenh_2, p_kenh_3, p_kenh_4, p_kenh_5,
         p_kenh_6, p_kenh_7, p_kenh_8, p_kenh_9, p_kenh_10)
    ON CONFLICT (ket_qua_hc_id, lan_do) DO UPDATE SET
        chi_thi_uut  = EXCLUDED.chi_thi_uut,
        kenh_1       = EXCLUDED.kenh_1,
        kenh_2       = EXCLUDED.kenh_2,
        kenh_3       = EXCLUDED.kenh_3,
        kenh_4       = EXCLUDED.kenh_4,
        kenh_5       = EXCLUDED.kenh_5,
        kenh_6       = EXCLUDED.kenh_6,
        kenh_7       = EXCLUDED.kenh_7,
        kenh_8       = EXCLUDED.kenh_8,
        kenh_9       = EXCLUDED.kenh_9,
        kenh_10      = EXCLUDED.kenh_10;
END;
$$;
 
-- Lấy chi tiết theo ket_qua_hc_id (1 dòng = 1 lần đo)
CREATE OR REPLACE FUNCTION fn_lay_chi_tiet_lan_do(p_ket_qua_hc_id INT)
RETURNS TABLE (
    lan_do        SMALLINT,
    chi_thi_uut   FLOAT,
    kenh_1        FLOAT,
    kenh_2        FLOAT,
    kenh_3        FLOAT,
    kenh_4        FLOAT,
    kenh_5        FLOAT,
    kenh_6        FLOAT,
    kenh_7        FLOAT,
    kenh_8        FLOAT,
    kenh_9        FLOAT,
    kenh_10       FLOAT
)
LANGUAGE sql STABLE AS $$
    SELECT lan_do, chi_thi_uut,
           kenh_1, kenh_2, kenh_3, kenh_4, kenh_5,
           kenh_6, kenh_7, kenh_8, kenh_9, kenh_10
    FROM chi_tiet_lan_do
    WHERE ket_qua_hc_id = p_ket_qua_hc_id
    ORDER BY lan_do;
$$;


CREATE OR REPLACE FUNCTION fn_xoa_chi_tiet_lan_do(p_ket_qua_hc_id INT)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
    DELETE FROM chi_tiet_lan_do WHERE ket_qua_hc_id = p_ket_qua_hc_id;
END;
$$;

-- ----------------------------------------------------------------
-- fn_lay_danh_sach_phien: Lấy danh sách tất cả phiên đo
-- Trả về: id, tên thiết bị, số hiệu, ngày hiệu chuẩn, số điểm đo,
--         số lần đo thô, ngày tạo
-- ----------------------------------------------------------------
DROP FUNCTION IF EXISTS fn_lay_danh_sach_phien();
 
CREATE OR REPLACE FUNCTION fn_lay_danh_sach_phien()
RETURNS TABLE (
    id                  INT,
    ten_thiet_bi        VARCHAR,
    ky_hieu             VARCHAR,
    so_hieu             VARCHAR,
    don_vi_su_dung      VARCHAR,
    ngay_hieu_chuan     DATE,
    so_diem_kiem_tra    BIGINT,   -- số dòng trong ket_qua_hieu_chuan
    so_lan_do_tho       BIGINT,   -- số dòng trong ket_qua_do
    ngay_tao            TIMESTAMP
)
LANGUAGE sql
STABLE
AS $$
    SELECT
        p.id,
        p.ten_thiet_bi,
        p.ky_hieu,
        p.so_hieu,
        p.don_vi_su_dung,
        p.ngay_hieu_chuan,
        COALESCE((
            SELECT COUNT(*) FROM ket_qua_hieu_chuan kqhc
            WHERE kqhc.phien_id = p.id
        ), 0) AS so_diem_kiem_tra,
        COALESCE((
            SELECT COUNT(*) FROM ket_qua_do kqd
            WHERE kqd.phien_id = p.id
        ), 0) AS so_lan_do_tho,
        p.ngay_tao
    FROM phien_hieu_chuan p
    ORDER BY p.ngay_tao DESC;
$$;
 
 
-- ----------------------------------------------------------------
-- fn_xoa_phien: Xóa toàn bộ phiên đo (cascade)
-- ----------------------------------------------------------------
DROP FUNCTION IF EXISTS fn_xoa_phien(INT);
 
CREATE OR REPLACE FUNCTION fn_xoa_phien(p_phien_id INT)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    DELETE FROM phien_hieu_chuan WHERE id = p_phien_id;
    -- ket_qua_do và ket_qua_hieu_chuan sẽ tự xóa nhờ ON DELETE CASCADE
END;
$$;