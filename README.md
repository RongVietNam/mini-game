## Mini Game - Làm theo hình ảnh

Trang web mini game cho phép:

- **Upload ảnh hoặc nhập link ảnh** (tối đa 50 ảnh).
- **Tạo tối đa 10 đội chơi**, quản lý điểm số theo từng lượt.
- **Cài đặt âm thanh** (upload file hoặc link) phát trong lúc random ảnh.
- **Cài thời gian:**
  - Thời gian random ảnh: random trong khoảng \[15s, 50s\] (hoặc khoảng bạn chỉnh).
  - Thời gian hiển thị ảnh tạo dáng: mặc định 10s (có thể chỉnh).
- **Mỗi ảnh chỉ xuất hiện 1 lần** trong toàn bộ game.

### Cách chạy

Yêu cầu có **Node.js** (>= 16).

```bash
cd /Users/daoviethung/Workspace/mini-game
npm install serve --no-save
npm start
```

Sau đó mở trình duyệt và truy cập địa chỉ mà `serve` in ra (thường là `http://localhost:3000` hoặc tương tự).

### Cách chơi

- **Bước 1**: Thêm ảnh (upload hoặc dán link), tạo danh sách đội, cài âm thanh nếu muốn.
- **Bước 2**: Chỉnh thời gian random và thời gian hiển thị ảnh (nếu cần).
- **Bước 3**: Bấm **Start**:
  - Hệ thống sẽ random ảnh liên tục trong một khoảng thời gian ngẫu nhiên từ 15–50s.
  - Sau đó chọn ngẫu nhiên 1 ảnh, hiển thị cố định trong X giây để các đội tạo dáng.
- **Bước 4**: Hết X giây, màn hình chuyển sang chế độ **chấm điểm**, bạn chọn 1 hoặc nhiều đội giống ảnh nhất, bấm **Xác nhận điểm & Lượt tiếp theo**.
- **Bước 5**: Ảnh đã dùng sẽ **bị loại khỏi danh sách**, bấm **Start** để bắt đầu lượt mới cho tới khi hết ảnh.  

