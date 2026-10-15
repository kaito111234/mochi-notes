# Phông chữ đi kèm (offline)

Tất cả phông dưới đây dùng giấy phép **SIL Open Font License 1.1** (toàn văn trong các file `OFL-<id>.txt`). Được phép dùng, đóng gói và phân phối kèm ứng dụng; không được bán riêng phông. Bản woff2 lấy từ gói npm `@fontsource/*` (bản 5.3.0), nguồn gốc là Google Fonts. Mỗi phông có 3 subset: `vietnamese`, `latin`, `latin-ext` (chỉ kiểu normal).

| Phông (family trong CSS) | Tác giả / bản quyền | Nguồn | Giấy phép | File đã chép |
|---|---|---|---|---|
| Itim (`Mochi Itim`) | (c) 2015 Cadson Demak; (c) 2014 Pablo Impallari | npm `@fontsource/itim` 5.3.0; Google Fonts | SIL OFL 1.1 (`OFL-itim.txt`) | `itim/itim-{vietnamese,latin,latin-ext}-400.woff2` |
| Pangolin (`Mochi Pangolin`) | (c) 2016 The Pangolin Project Authors | npm `@fontsource/pangolin` 5.3.0; Google Fonts | SIL OFL 1.1 (`OFL-pangolin.txt`) | `pangolin/pangolin-{...}-400.woff2` |
| Mali (`Mochi Mali`) | (c) 2018 The Mali Project Authors (Cadson Demak) | npm `@fontsource/mali` 5.3.0; Google Fonts | SIL OFL 1.1 (`OFL-mali.txt`) | `mali/mali-{...}-400.woff2`, `-600.woff2` |
| Nunito (`Mochi Nunito`) | (c) 2014 The Nunito Project Authors | npm `@fontsource/nunito` 5.3.0; Google Fonts | SIL OFL 1.1 (`OFL-nunito.txt`) | `nunito/nunito-{...}-400.woff2`, `-700.woff2` |
| Baloo 2 (`Mochi Baloo 2`) | (c) 2019 The Baloo 2 Project Authors (EkType) | npm `@fontsource/baloo-2` 5.3.0; Google Fonts | SIL OFL 1.1 (`OFL-baloo2.txt`) | `baloo2/baloo2-{...}-400.woff2`, `-700.woff2` |
| Be Vietnam Pro (`Mochi Be Vietnam Pro`) | (c) 2021 The Be Vietnam Pro Project Authors | npm `@fontsource/be-vietnam-pro` 5.3.0; Google Fonts | SIL OFL 1.1 (`OFL-bevietnam.txt`) | `bevietnam/bevietnam-{...}-400.woff2`, `-700.woff2` |

`fonts.css` khai báo @font-face (có `unicode-range` đúng từng subset, `font-display: swap`, đường dẫn tương đối).
