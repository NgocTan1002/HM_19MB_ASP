using System;

namespace HM_19MB_Core.Models
{
    /// <summary>
    /// Dữ liệu đầu vào cho phép tính độ không đảm bảo đo theo QTHC 1.013:2019.
    /// Tất cả thuộc tính là bất biến sau khi khởi tạo.
    /// </summary>
    public sealed class UncertaintyInput
    {
        /// <summary>Số kênh/đầu đo (j).</summary>
        public int J { get; init; }

        /// <summary>Số lần đo (n).</summary>
        public int N { get; init; }

        /// <summary>
        /// Dữ liệu thô từng lần đo từng kênh, kích thước n × j.
        /// Hàng = lần đo (i), cột = kênh (j).
        /// </summary>
        public double[,] MeasurementData { get; init; } = new double[0, 0];

        /// <summary>Số hiệu chính ∂t_j cho từng kênh, length = j.</summary>
        public double[] Corrections { get; init; } = Array.Empty<double>();

        /// <summary>Giá trị U từ thiết bị chuẩn cho từng kênh (U₁…Uⱼ), length = j.</summary>
        public double[] UValues { get; init; } = Array.Empty<double>();

        /// <summary>Giá trị ∂ từ thiết bị chuẩn cho từng kênh (∂₁…∂ⱼ), length = j.</summary>
        public double[] DeltaValues { get; init; } = Array.Empty<double>();

        /// <summary>Chỉ thị tủ bộ 1 (t_tn1), length = n.</summary>
        public double[] Ttn1 { get; init; } = Array.Empty<double>();

        /// <summary>Chỉ thị tủ bộ 2 (t_tn2), length = n.</summary>
        public double[] Ttn2 { get; init; } = Array.Empty<double>();

        /// <summary>Độ chia nhỏ nhất A (công thức 17).</summary>
        public double ResolutionA { get; init; }

        /// <summary>Hệ số nhân d (công thức 17): 0.5, 0.2 hoặc 0.1.</summary>
        public double ResolutionD { get; init; }

        /// <summary>true = dùng U/2 (CT10), false = dùng ∂/√3 (CT11).</summary>
        public bool UseUMethod { get; init; }

        /// <summary>Giá trị đặt trên tủ nhiệt (°C).</summary>
        public double GiaTriDat { get; init; }

        /// <summary>
        /// Kiểm tra tính hợp lệ của toàn bộ dữ liệu đầu vào.
        /// </summary>
        /// <returns>
        /// (true, "") nếu hợp lệ; (false, thông báo lỗi) nếu không.
        /// </returns>
        public (bool IsValid, string Error) Validate()
        {
            if (J < 1 || J > 10)
                return (false, $"Số kênh J phải từ 1 đến 10, hiện tại: {J}.");

            if (N < 2)
                return (false, $"Số lần đo N phải >= 2, hiện tại: {N}.");

            if (MeasurementData == null)
                return (false, "MeasurementData không được null.");

            if (MeasurementData.GetLength(0) != N || MeasurementData.GetLength(1) != J)
                return (false,
                    $"MeasurementData kích thước [{MeasurementData.GetLength(0)},{MeasurementData.GetLength(1)}] " +
                    $"không khớp N={N}, J={J}.");

            if (Corrections == null || Corrections.Length != J)
                return (false, $"Corrections.Length phải = {J}, hiện tại: {Corrections?.Length}.");

            if (UValues == null || UValues.Length != J)
                return (false, $"UValues.Length phải = {J}, hiện tại: {UValues?.Length}.");

            if (DeltaValues == null || DeltaValues.Length != J)
                return (false, $"DeltaValues.Length phải = {J}, hiện tại: {DeltaValues?.Length}.");

            if (Ttn1 == null || Ttn1.Length != N)
                return (false, $"Ttn1.Length phải = {N}, hiện tại: {Ttn1?.Length}.");

            if (Ttn2 == null || Ttn2.Length != N)
                return (false, $"Ttn2.Length phải = {N}, hiện tại: {Ttn2?.Length}.");

            if (ResolutionA <= 0)
                return (false, $"ResolutionA phải > 0, hiện tại: {ResolutionA}.");

            if (ResolutionD <= 0)
                return (false, $"ResolutionD phải > 0, hiện tại: {ResolutionD}.");

            return (true, string.Empty);
        }
    }
}
