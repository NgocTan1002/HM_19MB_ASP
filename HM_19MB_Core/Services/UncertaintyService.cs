using System;
using System.Linq;
using HM_19MB_Core.Models;

namespace HM_19MB_Core.Services
{
    /// <summary>
    /// Kết quả tính toán đầy đủ bao gồm cả phần chuẩn (u_ch) và phần chỉ thị tủ (u_bk).
    /// Bọc <see cref="UncertaintyCalculator.UncertaintyResult"/> và bổ sung các giá trị
    /// mà RecalculateAll() hiện đang tính nhưng UncertaintyResult chưa lưu.
    /// </summary>
    public sealed class UncertaintyFullResult
    {
        // ── Kết quả gốc từ UncertaintyCalculator ─────────────────────────
        /// <summary>Kết quả phần chuẩn (uch1, uch2, uc, …).</summary>
        public UncertaintyCalculator.UncertaintyResult StandardResult { get; init; } = null!;

        // ── Các giá trị bổ sung CT(1)–CT(6) ─────────────────────────────

        /// <summary>CT(1): t̄_ch — trung bình chuẩn đã hiệu chính (°C).</summary>
        public double Tch { get; init; }

        /// <summary>CT(2): t̄_j đã hiệu chính cho từng kênh.</summary>
        public double[] ChannelCorrectedMeans { get; init; } = Array.Empty<double>();

        /// <summary>CT(3): t̄_tn — trung bình chỉ thị tủ (°C).</summary>
        public double Ttn { get; init; }

        /// <summary>CT(4): Δt = t̄_ch − t̄_tn (°C).</summary>
        public double DeltaT { get; init; }

        /// <summary>CT(5): δt_od — độ ổn định (°C).</summary>
        public double DeltaOd { get; init; }

        /// <summary>CT(6): δt_dd — độ đồng đều (°C).</summary>
        public double DeltaDd { get; init; }

        // ── Các thành phần u_bk CT(13)–CT(18) ───────────────────────────

        /// <summary>CT(13)–(14): ubk1 = S/√n từ chỉ thị tủ.</summary>
        public double Ubk1 { get; init; }

        /// <summary>CT(15): ubk2 = δt_od / √3.</summary>
        public double Ubk2 { get; init; }

        /// <summary>CT(16): ubk3 = δt_dd / √3.</summary>
        public double Ubk3 { get; init; }

        /// <summary>CT(17): ubk4 = A × d / √3.</summary>
        public double Ubk4 { get; init; }

        /// <summary>CT(18): ubk = √(ubk1² + ubk2² + ubk3² + ubk4²).</summary>
        public double Ubk { get; init; }

        // ── Kết quả cuối CT(19) ──────────────────────────────────────────

        /// <summary>CT(19): U = 2 × √(u_ch² + u_bk²) — độ không đảm bảo mở rộng cuối cùng (°C).</summary>
        public double UFinal { get; init; }

        /// <summary>"U" hoặc "Delta" — phương pháp tính uch2.</summary>
        public string MethodUsed { get; init; } = string.Empty;

        // ── Truy cập nhanh các giá trị thường dùng từ StandardResult ─────

        /// <summary>uch1 — độ không đảm bảo loại A tổng hợp.</summary>
        public double Uch1 => StandardResult.Uch1;

        /// <summary>uch2 — độ không đảm bảo loại B (chọn từ U hoặc ∂).</summary>
        public double Uch2 => StandardResult.Uch2;

        /// <summary>uc — độ không đảm bảo chuẩn liên hợp CT(12).</summary>
        public double Uc => StandardResult.Uc;

        /// <summary>Trung bình từng kênh (chưa hiệu chính).</summary>
        public double[] ChannelMeans => StandardResult.ChannelMeans;

        /// <summary>Độ lệch chuẩn từng kênh.</summary>
        public double[] ChannelStdDevs => StandardResult.ChannelStdDevs;

        /// <summary>uch1,j từng kênh.</summary>
        public double[] ChannelTypeAUncertainties => StandardResult.ChannelTypeAUncertainties;
    }

    /// <summary>
    /// Service tính toán độ không đảm bảo đo theo QTHC 1.013:2019.
    /// Không phụ thuộc UI — chỉ gọi các hàm toán trong <see cref="UncertaintyCalculator"/>.
    /// </summary>
    public static class UncertaintyService
    {
        /// <summary>
        /// Thực hiện toàn bộ phép tính từ CT(1) đến CT(19),
        /// cho kết quả số giống hệt RecalculateAll() trong UncertaintyCalculationForm.
        /// </summary>
        /// <param name="input">Dữ liệu đầu vào đã được thu thập từ UI hoặc nguồn khác.</param>
        /// <returns>Kết quả đầy đủ bao gồm cả phần chuẩn và phần chỉ thị tủ.</returns>
        /// <exception cref="ArgumentException">Khi dữ liệu đầu vào không hợp lệ.</exception>
        public static UncertaintyFullResult Calculate(UncertaintyInput input)
        {
            // ── Validate đầu vào ────────────────────────────────────────
            var (isValid, error) = input.Validate();
            if (!isValid)
                throw new ArgumentException(error, nameof(input));

            int j = input.J;
            int n = input.N;

            // ── CT(7)–(9): Tính từng kênh — t̄j, Sj, uch1,j ────────────
            // Sau đó tổng hợp uch1 = √Σ(uch1,j²)
            // Đồng thời tính Max(U), Max(∂), uch2, uc
            // → Dùng CalculateFull() cho toàn bộ khối này.
            var stdResult = UncertaintyCalculator.CalculateFull(
                input.MeasurementData,
                input.UValues,
                input.DeltaValues,
                input.UseUMethod);

            // ── CT(1)–(2): t̄_ch, t̄_j hiệu chính ──────────────────────
            var (tch, channelCorrectedMeans) = UncertaintyCalculator
                .CalculateCorrectedTemperature(input.MeasurementData, input.Corrections);

            // ── CT(5): δt_od — độ ổn định ───────────────────────────────
            double deltaOd = UncertaintyCalculator.CalculateStability(input.MeasurementData);

            // ── CT(6): δt_dd — độ đồng đều ──────────────────────────────
            double deltaDd = UncertaintyCalculator.CalculateUniformity(channelCorrectedMeans);

            // ── CT(3): t̄_tn — trung bình chỉ thị tủ ────────────────────
            double ttn = UncertaintyCalculator
                .CalculateMeanIndicatorTemperature(input.Ttn1, input.Ttn2);

            // ── CT(4): Δt = t̄_ch − t̄_tn ───────────────────────────────
            double deltaT = UncertaintyCalculator.CalculateCorrection(tch, ttn);

            // ── CT(13)–(14): ubk1 = S/√n từ t_i = (ttn1+ttn2)/2 ────────
            double[] ti = new double[n];
            for (int i = 0; i < n; i++)
                ti[i] = (input.Ttn1[i] + input.Ttn2[i]) / 2.0;

            double ubk1 = UncertaintyCalculator.CalculateIndicatorTypeA(ti);

            // ── CT(15): ubk2 = δt_od / √3 ──────────────────────────────
            double ubk2 = UncertaintyCalculator.CalculateUbk2(deltaOd);

            // ── CT(16): ubk3 = δt_dd / √3 ──────────────────────────────
            double ubk3 = UncertaintyCalculator.CalculateUbk3(deltaDd);

            // ── CT(17): ubk4 = A × d / √3 ──────────────────────────────
            double ubk4 = UncertaintyCalculator.CalculateUbk4(input.ResolutionA, input.ResolutionD);

            // ── CT(18): ubk = √(ubk1² + ubk2² + ubk3² + ubk4²) ────────
            double ubk = UncertaintyCalculator.CalculateCombinedUbk(ubk1, ubk2, ubk3, ubk4);

            // ── CT(19): U = 2 × √(uc² + ubk²) ─────────────────────────
            double uFinal = UncertaintyCalculator
                .CalculateFinalExpandedUncertainty(stdResult.Uc, ubk);

            // ── Đóng gói kết quả ────────────────────────────────────────
            return new UncertaintyFullResult
            {
                StandardResult = stdResult,
                Tch = tch,
                ChannelCorrectedMeans = channelCorrectedMeans,
                Ttn = ttn,
                DeltaT = deltaT,
                DeltaOd = deltaOd,
                DeltaDd = deltaDd,
                Ubk1 = ubk1,
                Ubk2 = ubk2,
                Ubk3 = ubk3,
                Ubk4 = ubk4,
                Ubk = ubk,
                UFinal = uFinal,
                MethodUsed = input.UseUMethod ? "U" : "Delta",
            };
        }
    }
}
