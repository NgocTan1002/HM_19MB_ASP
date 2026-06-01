# Phase 2 Checklist

## Kết nối

- [ ] SignalR connect thành công, có log trong DevTools `Network` tab, filter `WS`.
- [ ] Client join đúng group `Session_{id}`. Kiểm tra server log trong `MeasurementHub.JoinSession`.
- [ ] `HealthIndicator` chuyển xanh trong 3 giây sau khi connect và nhận block đầu tiên.
- [ ] Khi ngắt mạng hoặc dừng dữ liệu 15 giây, `HealthIndicator` chuyển vàng.
- [ ] Khi ngắt mạng hoặc dừng dữ liệu 35 giây, `HealthIndicator` chuyển đỏ.
- [ ] SignalR tự reconnect khi mạng trở lại.
- [ ] Sau reconnect, client tự gọi lại `JoinSession` với session hiện tại.

## ProbeDataTable

- [ ] Hiển thị đúng số dòng active: `probeCount` dòng đầu đo có dữ liệu và 3 dòng tổng hợp.
- [ ] Các đầu đo không active hiển thị `---`.
- [ ] Column `Độ ẩm (%)` ẩn khi không có humidity data.
- [ ] Delta T hiển thị chỉ cho dòng đầu đo 1-10.
- [ ] Delta T màu xanh khi `|delta| <= 0.5`.
- [ ] Delta T màu vàng khi `0.5 < |delta| <= 1.0`.
- [ ] Delta T màu đỏ khi `|delta| > 1.0`.
- [ ] Dòng có `|delta T|` lớn nhất được highlight.
- [ ] Click dòng đầu đo gọi đúng `onProbeSelect(index)`.

## TemperatureChart

- [ ] Line xuất hiện cho từng đầu đo active.
- [ ] Line trung bình nhiệt độ luôn hiển thị.
- [ ] Trục độ ẩm chỉ hiển thị khi `showHumidity = true`.
- [ ] Buffer không vượt quá 720 điểm sau khi nhận nhiều block.
- [ ] Zoom bằng kéo vùng thời gian hoạt động.
- [ ] `Reset Zoom` trả biểu đồ về toàn bộ dữ liệu.
- [ ] `Xóa dữ liệu` clear chart.
- [ ] Click legend ẩn/hiện đúng line đầu đo tương ứng.
- [ ] Tooltip hiển thị đầy đủ giá trị tại điểm hover.
- [ ] Chart update liên tục không bật animation gây lag.

## DashboardControls

- [ ] Toggle humidity mode ảnh hưởng cả chart và table.
- [ ] `Chỉ độ ẩm` và `Nhiệt + Ẩm` bị disable khi block không có humidity data.
- [ ] Checkbox đầu đo disable đúng khi giá trị nhiệt độ là `NaN` hoặc đầu đo không active.
- [ ] `Chọn tất cả` bật các đầu đo có thể hiển thị.
- [ ] `Bỏ chọn tất cả` ẩn các line/rows đầu đo.
- [ ] Khi recording, số lần đo tăng đúng theo block nhận được.
- [ ] Khi recording, thời gian ghi tăng mỗi giây.
- [ ] `Xuất Excel` download đúng filename `BaoCao_{sessionId}_{timestamp}.xlsx`.

## Performance Checklist

- [ ] Không có re-render không cần thiết trong React DevTools Profiler.
- [ ] Chart update không gây jank, FPS duy trì trên 30 khi data đến nhanh.
- [ ] Memory không tăng bất thường sau 1000 blocks, kiểm tra bằng heap snapshot.
- [ ] Không có interval/timer còn sống sau khi unmount Dashboard.
- [ ] SignalR handler không bị đăng ký trùng sau khi đổi session.

## Lỗi Thường Gặp Phase 2

### Recharts `ResizeObserver loop` Warning

Thường xuất hiện khi container đổi kích thước liên tục hoặc nằm trong layout chưa ổn định.

Cách xử lý:

- Đảm bảo container chart có height cố định hoặc prop `height`.
- Tránh render chart trong container `display: none`.
- Nếu chart nằm trong tab/collapse, chỉ render chart sau khi panel visible.
- Warning này thường không làm hỏng dữ liệu, nhưng nếu xuất hiện liên tục thì cần kiểm tra layout.

### SignalR Event Không Fire

Nguyên nhân phổ biến nhất là group name lệch chữ hoa/thường.

Kiểm tra:

```csharp
await Groups.AddToGroupAsync(Context.ConnectionId, $"Session_{sessionId}");
```

```csharp
await _hub.Clients
    .Group($"Session_{sessionId}")
    .SendAsync("MeasurementReceived", block);
```

`Session_` phải giống nhau tuyệt đối.

### Chart Không Update

Kiểm tra:

- `newBlock` có đổi reference sau mỗi lần nhận SignalR không.
- `isAnimationActive={false}` đã đặt cho các `Line`.
- Buffer có được snapshot sang state theo throttle không.
- Không dùng `key` thay đổi liên tục trên root chart vì sẽ remount chart và mất zoom/buffer.

### Memory Leak Từ `setInterval`

Pattern cleanup đúng:

```ts
useEffect(() => {
  const intervalId = window.setInterval(() => {
    // update state
  }, 1000);

  return () => {
    window.clearInterval(intervalId);
  };
}, []);
```

Với `setTimeout` throttle, cũng cần clear trong cleanup nếu timeout còn pending.
