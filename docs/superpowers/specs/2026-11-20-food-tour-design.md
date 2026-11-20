# Food Tour App: Thiết kế

Ngày: 2026-11-20 · Trạng thái: **đã duyệt** 2026-11-20

## 1. Mục đích và lý do

Web dùng riêng cho **một hội bạn** hay đi ăn chơi cùng nhau ở nhiều thành phố. Hiện nhóm lên kế hoạch bằng bảng tính (xem `Food tour Hải Phòng - Food tour Hải Phòng.pdf`).

Khâu **mất công nhất** là **tìm chỗ**: quán ăn, chỗ chơi và chỗ nghỉ có giá hợp lý, nhất là ở nơi nhóm chưa đi bao giờ.

Luồng chính:

> Chọn thành phố + loại chỗ → web đưa danh sách ứng viên đã xếp hạng (điểm cao, nhiều đánh giá) kèm tóm tắt "mạng xã hội nói gì" → người dùng tự vào kiểm tra → bấm **thêm vào danh sách của chuyến đi**.

Danh sách quán của nhóm được **tích lũy qua các chuyến** (ai thêm, ghi chú, đã ăn chưa, khen/chê). Lần sau quay lại thì có sẵn.

## 2. Mục tiêu / Không làm / Thất bại nếu

**Mục tiêu (v1)**
- Tìm theo thành phố + loại chỗ (ăn uống, cafe/ăn vặt, chỗ chơi, chỗ nghỉ) + mức giá.
- Xếp hạng có tính cả số lượt đánh giá, không chỉ điểm trung bình.
- Mỗi kết quả có: điểm, số đánh giá, mức giá, giờ mở cửa, địa chỉ, link Google Maps và các nút "xem trên Threads / TikTok / Google" (mở trang tìm kiếm theo tên quán + thành phố).
- AI bổ sung: (a) tóm tắt dư luận trên mạng cho từng quán, có link nguồn; (b) gợi ý thêm quán "đang hot" mà Google xếp thấp.
- Nhóm và chuyến đi: tạo nhóm, mời bạn, tạo chuyến (thành phố, ngày), thêm/bỏ chỗ vào danh sách chuyến, ghi chú.
- Sổ quán của nhóm: mọi chỗ từng thêm, kèm trạng thái đã đi/chưa đi và đánh giá nội bộ (khen/chê + ghi chú, ví dụ "lần trước 50k/bát mà không ngon").
- **Chỉ tối ưu cho điện thoại** (người dùng chốt). Desktop hiển thị cột giữa rộng tối đa ~480px, không có layout riêng.
- **Nhập dữ liệu chuyến Hải Phòng 23–24/11/2026** từ file PDF vào sổ quán, dùng seed script chạy một lần. Gồm khoảng 15 chỗ: bánh đa cua Bà Cụ, cafe cô Hạnh, nem cua bể Quán Nga, bánh bèo cô Mây, bánh đúc tàu 159 Hai Bà Trưng, chè Hường, dừa dầm cô Thủy, kem xôi Bạch Tuyết, Hương Ốc, Chè Thái, bánh mì que 172 Hàng Kênh, bún cá Thắng Tồ, bánh mì trứng đánh kem 2/D4 Nguyễn Bình… Mỗi chỗ giữ ghi chú, giờ mở cửa và giá ước tính có trong file. Hai quán "không ăn" (100 Trần Nhật Duật, dừa dầm Hiền Béo) được nhập với đánh giá nội bộ **chê**. Từng chỗ được đối chiếu với Google Places để lấy `place_id`, chỗ nào không khớp thì để nhãn "chưa xác minh".

**Không làm ở v1** (để sau, nếu cần)
- Lịch theo khung giờ, cảnh báo trùng giờ đóng cửa.
- Chia tiền.
- Đặt phòng/đặt bàn trong web. Chỗ nghỉ chỉ dẫn link sang Agoda/Booking/Google.
- Trang công khai, SEO, review cho người ngoài nhóm.
- App di động native.

**Thất bại nếu**
- AI đưa địa chỉ sai hoặc quán không tồn tại mà không có cảnh báo.
- Chi phí API vượt ngoài tầm (mục tiêu: Places và Gemini đều nằm trong hạn miễn phí với 1 nhóm, trần tháng chặn trước khi phát sinh phí).
- Tìm một thành phố mất quá lâu (> ~5 giây cho danh sách gốc).

## 3. Ràng buộc

- **Google Places API (New)**: có điểm, số đánh giá, `priceLevel`, giờ mở cửa. Theo điều khoản của Google, chỉ `place_id` được lưu lâu dài. Các trường khác chỉ cache ngắn hạn, phải tải lại khi hiển thị chi tiết.
- **Threads/TikTok/Facebook**: không có API tìm kiếm tự do cho web cá nhân. Threads API cần Meta duyệt app. Vì vậy AI chỉ đọc được nội dung công khai qua tìm kiếm web, còn người dùng tự kiểm tra qua link.
- **Chỗ nghỉ**: Agoda/Booking không mở dữ liệu giá. Google Places có khách sạn/homestay với điểm và số đánh giá, nhưng `priceLevel` thường trống.
- Secret (khóa Google, khóa AI) chỉ ở server và trong `.env`, có `.env.example`.

## 4. Các hướng đã cân nhắc

| Hướng | Mô tả | Đánh đổi |
| --- | --- | --- |
| A | Chỉ Google Places + xếp hạng + nút kiểm tra mạng xã hội | Rẻ, nhanh, dữ liệu chuẩn; không biết dư luận |
| B | Chỉ AI tìm trên web/mạng xã hội | Bắt được quán hot; tốn phí, dễ sai địa chỉ |
| **C (đã chọn)** | **Places làm danh sách gốc + AI bổ sung dư luận và quán hot** | Đầy đủ nhất; nhiều việc nhất, phải kiểm soát chi phí AI |

Người dùng chọn **C**.

## 5. Thiết kế

### 5.1 Xếp hạng
Dùng điểm Bayes: `score = (v/(v+m))·R + (m/(v+m))·C`. Trong đó R là điểm của quán, v là số đánh giá, C là điểm trung bình của tập kết quả, m là hằng số (mặc định 50, đặt trong config). Có thể lọc tối thiểu số đánh giá và mức giá.

### 5.2 AI bổ sung
- **Tóm tắt dư luận cho từng quán**: chỉ chạy khi người dùng bấm "Mạng xã hội nói gì?" để tiết kiệm phí. Dùng **Gemini API** (khóa tạo ở Google AI Studio) với Grounding with Google Search. Người dùng chọn Gemini vì đã có tài khoản Gemini Pro. Lưu ý: gói Gemini Pro dùng trong app **không** gồm quota API. API được tính riêng, dùng gói miễn phí trước, vượt mức thì trả theo lượt. Tên model đặt trong config. Kết quả gồm: 2–4 ý khen/chê, khoảng giá được nhắc, cảnh báo (đông, chặt chém…), và **link nguồn bắt buộc**. Cache theo `place_id` trong 14 ngày.
- **Quán hot AI gợi ý**: một nút cho mỗi lượt tìm (thành phố + loại). AI trả về tên quán và địa chỉ. Server đối chiếu từng quán với Google Places:
  - khớp → đưa vào danh sách kèm nhãn "AI gợi ý";
  - không khớp → hiện riêng với nhãn **"chưa xác minh"**.
  
  Cache theo (thành phố, loại) trong 7 ngày.
- Giới hạn số lần gọi AI mỗi ngày cho mỗi nhóm (config).

### 5.3 Dữ liệu chính
- `users`, `groups`, `group_members` (vai trò: owner/member)
- `trips` (group, thành phố, ngày đi/về, tên)
- `places` (place_id Google hoặc chỗ thêm tay, tên, loại, thành phố, link): sổ quán của nhóm
- `trip_places` (trip, place, người thêm, ghi chú, trạng thái: muốn đi / đã chốt / đã đi / bỏ)
- `place_reviews_internal` (place, user, khen/chê, ghi chú, chuyến)
- `ai_cache` (khóa, nội dung, hết hạn)

### 5.4 Màn hình
1. Đăng nhập (Google hoặc link qua email).
2. Nhóm → danh sách chuyến đi.
3. Chuyến đi: danh sách chỗ đã thêm, chia theo loại.
4. Khám phá: ô tìm kiếm thành phố + loại + mức giá → danh sách xếp hạng → thẻ chi tiết (nút kiểm tra mạng xã hội, nút AI, nút "Thêm vào chuyến").
5. Sổ quán của nhóm: tìm/lọc mọi chỗ từng thêm, kèm đánh giá nội bộ.

### 5.5 Công nghệ (quyết định của Claude, có thể đổi)
- Next.js (App Router) + TypeScript, Tailwind.
- Supabase: Postgres + Auth + Row Level Security (chỉ thành viên nhóm thấy dữ liệu nhóm).
- Gọi Google Places và Gemini **chỉ từ server** (route handler).
- Deploy: Vercel + Supabase gói miễn phí.

### 5.6 Quyết định thêm (Claude chọn sau lượt review, có thể đổi)
- **Lưu dữ liệu Google**: `places` lưu `place_id` cùng tên, thành phố và địa chỉ, coi đây là nhãn do nhóm tự lưu, để có thể tìm trong sổ quán. Điểm, số đánh giá, giờ mở cửa và giá **không lưu lâu dài**: tải lại từ Places Details khi mở thẻ chi tiết, cache tối đa 24 giờ.
- **Đăng nhập**: chỉ người được mời mới vào được. Owner gửi link mời có hạn dùng, và email chưa có lời mời thì bị chặn ở bước đăng nhập. Một người có thể ở nhiều nhóm.
- **Ước lượng tải Google**: khoảng 500 lượt tìm/tháng cho 1 nhóm, 20 kết quả/lượt (không phân trang). Kết quả tìm cùng (thành phố, loại, mức giá) được cache 24 giờ. Field mask chỉ lấy các trường cần dùng. Mức này nằm trong hạn miễn phí hằng tháng của SKU Enterprise.
- **Chỗ chưa xác minh**: được thêm vào chuyến và sổ quán, với `place_id` để trống và địa chỉ tự nhập. Nhãn "chưa xác minh" hiện ở mọi nơi. Có thao tác "gắn với Google Maps" để liên kết sau.
- **Chặn chi phí AI**: ngoài giới hạn theo ngày của mỗi nhóm, có thêm một trần tổng mỗi tháng (config). Vượt trần thì tắt nút AI và báo cho người dùng.

### 5.7 Giao diện (người dùng chốt)
- Font **Be Vietnam Pro** cho toàn bộ chữ, dùng các độ đậm 400/500/600/700/800 và tải qua `next/font`.
- **Góc chỉ bo nhẹ**: 4px cho nút, ô nhập, chip; 6px cho thẻ, khối và nút nổi. Riêng avatar để tròn. Các giá trị này là token dùng chung, không viết rải rác.
- Giữ bảng màu của bản mẫu: nền trắng, chữ #1C1B19, màu nhấn đỏ cam #D9431E / #B2341A, xanh lá #1E6A4C cho "khen/đang mở", xanh dương #2E4A7D cho AI.
- Bản mẫu UI: https://claude.ai/artifact/7mmaQ97GDDnux8tZyuYq2N

### 5.8 Kiến trúc (Claude chọn, người dùng giao: sạch, dễ mở rộng)
- Chia code **theo tính năng**: `src/features/{groups,trips,places,explore,ai}`. Mỗi tính năng có các tầng `ui/` (component) → `actions/` (server action / route handler) → `services/` (nghiệp vụ) → `repositories/` (Supabase). Gọi API bên ngoài nằm trong `src/integrations/{google-places,gemini}`, có interface riêng để mock khi test và đổi nhà cung cấp sau này.
- Phần dùng chung để trong `src/shared/` (ui primitives, config, cache, lỗi). Không gọi tắt qua tầng.
- Toàn bộ cấu hình và giới hạn để ở `src/shared/config` và đọc từ env. Có `.env.example`.

### 5.9 Tốc độ, độ mượt và cache (người dùng ưu tiên)
- **Cache phía server, 2 lớp**:
  - **Redis (Upstash, gói miễn phí)** lưu kết quả tìm Places theo khóa (thành phố, loại, mức giá) trong 24 giờ, Place Details 24 giờ, và cờ đếm giới hạn AI.
  - **Postgres `ai_cache`** lưu bền các tóm tắt AI: 14 ngày cho tóm tắt quán, 7 ngày cho quán hot.
  - Lớp cache nằm sau interface `CacheStore` để có thể đổi cách lưu.
- **Cache phía client**:
  - Dùng TanStack Query, lưu cache vào IndexedDB để mở lại app là thấy dữ liệu ngay, sau đó mới làm mới ngầm (stale-while-revalidate).
  - Cập nhật lạc quan (optimistic) cho thêm/bỏ chỗ, đổi trạng thái và đánh giá nội bộ.
- **Tải nhanh**:
  - Server Components cho các trang đọc dữ liệu, và prefetch khi link xuất hiện.
  - Skeleton thay cho spinner, danh sách dài dùng virtual list.
  - Cài được như **PWA**, cache sẵn khung app để mở gần như tức thì và xem được danh sách chuyến khi mạng yếu.
- **Mục tiêu đo được trên mobile 4G**: LCP < 2s, chuyển màn < 200ms khi đã có cache, kết quả Khám phá < 1.5s khi trúng cache và < 5s khi chưa có cache.

## 6. Để lại cho người xây dựng
- Cấu trúc thư mục, thư viện UI, cách tổ chức tầng.
- Map loại chỗ → `includedType` / từ khóa của Google Places.
- Prompt AI cụ thể và schema JSON trả về.
- Thiết kế giao diện chi tiết (ưu tiên mobile).
