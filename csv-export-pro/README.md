# CSV Export Pro (v1.5.2)

Custom **component plugin** สำหรับ Budibase (v3.4.0 ขึ้นไป, Svelte 3)
ที่ export ข้อมูลเป็นไฟล์ **CSV** หรือ **Excel (.xlsx) ที่มีสีติดจริง** โดย config ทั้งหมด
ทำผ่าน **Components Setting panel ล้วนๆ** ไม่มีปุ่ม "Design" / popup แยกต่างหากอีกต่อไป

- เลือกแหล่งข้อมูลได้จาก **Table, View หรือ Data provider** ผ่าน setting เดียว (unified data source picker)
- เลือก/เรียงลำดับ/ตั้งชื่อคอลัมน์แบบ Excel ผ่าน setting **Columns** ในตัวของ Budibase เอง
- ตั้งสี **ส่วนหัว (Header)** กับ**ข้อมูลในคอลัมน์ (Data)** แยกกันได้ — Header สีเดียวทั้งแถว, Data ตั้งสีต่อคอลัมน์ได้
- ใส่ **เส้นกรอบตาราง (Excel grid borders)** ให้ไฟล์ที่ export ได้ เปิด/ปิดได้
- ตั้ง **ความกว้าง / การจัดวาง** ต่อคอลัมน์ได้ ผ่านไอคอนรูปเฟือง (gear) ข้างแต่ละคอลัมน์
- เพิ่มคอลัมน์ **ลำดับ (No. / ลำดับ)** อัตโนมัติที่หน้าสุดได้
- เขียน **JavaScript แปลงข้อมูลรายคอลัมน์** ขั้นสูงได้ (ผ่านช่อง JSON)
- Export เป็น **CSV (UTF-8 with BOM)** หรือ **Excel (.xlsx) พร้อมสีและกรอบ** เลือกได้
- มี **Preview แบบ Excel เฉพาะตอนอยู่ใน Builder** ให้เห็นผลก่อน publish จริง
- ปุ่มหลักเขียนว่า **Export Csv** (แก้ข้อความได้)

**Author:** Thanakrit Yaemsuk

---

## Build

ต้องมี Node.js v20+

```bash
npm install
npm run build
```

ผลลัพธ์อยู่ใน `dist/`:

- `plugin.min.js`
- `schema.json` (ใส่ hash + version ให้อัตโนมัติ)
- `package.json`
- `csv-export-pro-1.5.2.tar.gz` ← ไฟล์นี้ใช้ import เข้า Budibase

## Import เข้า Budibase

1. เปิด Budibase Portal → **Plugins** → **Add plugin**
2. เลือก Source เป็น **File Upload** แล้วอัปโหลด `dist/csv-export-pro-1.5.2.tar.gz`
   (หรือใช้ **GitHub / URL** ถ้า push repo ขึ้นไป)
3. เข้าแอป → ในรายการ component จะมีหมวด **Plugins → CSV Export Pro**

> ⚠️ ถ้าอัปเดตจากเวอร์ชันเก่า (v1.1.x หรือก่อนหน้า): ต้องลบปลั๊กอินเก่าออกจาก Portal → Plugins ก่อน
> แล้วค่อย import ตัวใหม่ ค่า column design ที่เคยเซฟไว้ผ่านปุ่ม "Design" (เก็บใน localStorage)
> **จะไม่ auto-migrate มาให้** เพราะสถาปัตยกรรมเปลี่ยนไปเก็บเป็นค่า component setting ของแอปแทน
> ต้องตั้งคอลัมน์ใหม่ผ่าน Settings panel รอบแรกหลัง import

> พัฒนาแบบ live reload: ตั้ง env `PLUGINS_DIR`, รัน `budi hosting --start` แล้ว `npm run watch` ในโฟลเดอร์นี้

## วิธีใช้ในแอป

1. วาง component **CSV Export Pro** ลงบนหน้าจอ
2. ตั้งค่า **Data source** — เลือกได้ทั้ง 3 แบบจาก dropdown เดียว:
   - **Table** — ดึงข้อมูลตรงจาก table ที่เลือก ไม่ต้องมี Data Provider เลย
   - **View** — เหมือน Table แต่ผ่าน view ที่ตั้งไว้
   - **Data provider** — เลือก Data Provider component ที่วางอยู่บนหน้าจอ (ใช้ filter/sort ที่ตั้งไว้ใน provider นั้นได้)
3. ตั้งค่า **Columns** — คลิกเพื่อเปิด drawer แบบ Excel:
   - **Add column** เลือกฟิลด์จาก dropdown "Column" + ตั้งชื่อหัวคอลัมน์ในช่อง "Label"
   - ลากไอคอน 6 จุดเพื่อ**เรียงลำดับ**คอลัมน์
   - กด **X** เพื่อลบคอลัมน์ออก, **Add all columns** เพื่อเพิ่มทุกฟิลด์รวดเดียว
   - คลิก **ไอคอนเฟือง (gear)** ข้างคอลัมน์ เพื่อตั้ง:
     - **Width** — ความกว้างคอลัมน์ (ใส่หน่วยด้วย เช่น `120px`)
     - **Alignment** — Left / Center / Right
     - **Value** — custom binding ถ้าอยากเปลี่ยนค่าที่แสดง (ปกติปล่อย `{{ Value }}` ไว้ตามเดิม)
     - **Background color** / **Text color** — สีพื้นหลัง/ตัวอักษรของ**แถวข้อมูล**ในคอลัมน์นั้น (ไม่รวมหัวคอลัมน์)
4. ตั้งสี**ส่วนหัว (Header)** แยกต่างหากที่ setting **Header background color** / **Header text color**
   (ใช้สีเดียวกันทั้งแถวหัวตาราง ไม่ต้องตั้งทีละคอลัมน์)
5. เปิด/ปิด **Cell borders (Excel grid lines)** เพื่อใส่กรอบเส้นบางๆ รอบทุกเซลล์แบบ Excel ปกติ
6. (ถ้าต้องการ) เปิด **Add row number column** เพื่อเพิ่มคอลัมน์ลำดับ (No. / ลำดับ) ไว้หน้าสุด
7. เลือก **Export format**: `CSV` หรือ `Excel (.xlsx) with colors`
8. กด **Export Csv** (แก้ข้อความปุ่มได้ที่ setting **Button text**) เพื่อดาวน์โหลดไฟล์

### สีคอลัมน์ ใช้ตรงไหน

**Header (หัวตาราง)** ตั้งที่ setting "Header background color" / "Header text color" (สีเดียวทั้งแถว)
**Data (แถวข้อมูล)** ตั้งแยกต่อคอลัมน์ผ่านไอคอนเฟืองใน Columns (ข้อ 3 ด้านบน)

| ตั้งค่าที่ | ไปโชว์ที่ |
| --- | --- |
| Background color / Text color (ไอคอนเฟือง) | ✅ Preview ใน Builder และ ✅ ไฟล์ Excel (.xlsx) จริง ถ้าเลือก Export format เป็น xlsx |
| — | ❌ ไฟล์ CSV — **เป็นไปไม่ได้เสมอ** เพราะ CSV เป็น plain text ล้วนๆ ไม่มีที่เก็บสีในไฟล์เลยไม่ว่าจะตั้งค่ายังไง ถ้าอยากได้สีในไฟล์จริง ต้องเลือก Export format = Excel |

## Advanced: JS transform (ช่อง JSON)

ช่อง **"Advanced: JS transforms (JSON)"** ใช้สำหรับ logic ที่ Value binding ธรรมดาทำไม่ได้ เช่น
ปัดทศนิยม, ต่อ string, if/else ฯลฯ — คีย์ใน JSON ต้องตรงกับ**ชื่อ field จริง** (ตัวพิมพ์เล็ก/ใหญ่ไม่เป็นไร
match แบบไหนก็ได้ทั้งชื่อ field หรือ Label ที่ตั้งไว้):

```json
{
  "amount": { "transform": "helpers.round(value, 2)" },
  "created_at": { "transform": "helpers.date(value)" }
}
```

ตัวอย่างการเขียน transform:

```js
// ต่อหน่วยเงิน
value + ' บาท'

// จัดรูปแบบวันที่ไทย
helpers.date(value)            // helpers.date(value, 'en-US') ก็ได้

// ปัดทศนิยม 2 ตำแหน่ง
helpers.round(value, 2)

// รวมหลายฟิลด์
row.first_name + ' ' + row.last_name

// เขียนเป็น statement พร้อม return ก็ได้
if (!value) return '-'; return value.toUpperCase();
```

helpers ที่ใช้ได้: `upper`, `lower`, `trim`, `round(v, d)`, `number(v)`, `date(v, locale)`, `join(v, sep)`

ถ้า JSON พิมพ์ผิด (invalid JSON หรือคีย์ไม่ตรงกับคอลัมน์ไหนเลย) จะมีข้อความเตือนสีแดงโชว์ใต้ Preview
ใน Builder ให้เห็นทันที

## Settings ทั้งหมด

| Setting | ความหมาย |
| --- | --- |
| Data source | Table / View / Data provider เลือกจาก dropdown เดียว |
| Columns | เลือก/เรียง/ตั้งชื่อคอลัมน์ + สีข้อมูล/ความกว้าง/การจัดวางผ่านไอคอนเฟือง |
| Header background color | สีพื้นหลังแถวหัวตาราง (ทั้งแถว) |
| Header text color | สีตัวอักษรแถวหัวตาราง (ทั้งแถว) |
| Cell borders (Excel grid lines) | เปิด/ปิดกรอบเส้นรอบทุกเซลล์ในไฟล์ Excel ที่ export |
| Add row number column | เพิ่มคอลัมน์ลำดับ (No. / ลำดับ) ไว้หน้าสุด |
| Row number column header | ข้อความหัวคอลัมน์ลำดับ |
| Row number column width | ความกว้างคอลัมน์ลำดับ เช่น `60px` |
| Row number column alignment | Left / Center / Right ของคอลัมน์ลำดับ |
| Advanced: JS transforms (JSON) | override การคำนวณค่าต่อคอลัมน์ด้วย JS (ไม่ใช่ที่ตั้งสีหลักแล้ว) |
| Show Excel-style preview (Builder only) | เปิด/ปิดตาราง preview ที่โชว์เฉพาะตอนอยู่ใน Builder |
| Export format | `CSV` หรือ `Excel (.xlsx) with colors` |
| Button text | ข้อความบนปุ่ม (ค่าเริ่มต้น `Export Csv`) |
| File name | ชื่อไฟล์ (ไม่ต้องใส่นามสกุลไฟล์) |
| Delimiter | `,` / `;` / Tab — โชว์เฉพาะตอนเลือก Export format = CSV |
| UTF-8 BOM | ใส่ BOM เพื่อให้ Excel อ่านไทยถูก — โชว์เฉพาะตอนเลือก Export format = CSV |
| Button size | S / M / L |
| On export | trigger action ของ Budibase หลัง export สำเร็จ (context: `rowCount`, `fileName`) |

## หมายเหตุ / ข้อจำกัด

- โหมด **Table/View** ดึงข้อมูลทั้งหมดตรงจาก API (ไม่ผ่าน pagination ของ Data Provider) ส่วนโหมด
  **Data provider** จะ export ตามแถวที่ provider นั้นโหลดมาให้ (ตาม filter/sort/limit ที่ตั้งไว้)
- Data source ประเภท **Query** ยังไม่รองรับการดึงตรง — ถ้าต้องการ export จาก Query ให้ผูกผ่าน
  Data Provider แทน
- Preview ใน Builder ใช้สีชุดเดียวกับที่จะ apply ตอน export จริง (เมื่อเลือกโหมด Excel) สีที่เห็นใน
  Preview = สีที่ได้ในไฟล์
- ใช้ได้กับ Budibase v3.4.0 ขึ้นไป (client เป็น Svelte 3) build ด้วย Svelte 3 แท้ (svelte ^3.49)

## โครงสร้างไฟล์

```
index.js               ← entry point, ลงทะเบียนปลั๊กอิน, import Wrapper
lib/Wrapper.svelte      ← ห่อ Component ด้วย error boundary
lib/Boundary.js         ← createBoundary จาก @crownframework/svelte-error-boundary (Svelte 3)
lib/Boundary.svelte     ← UI แสดง error ถ้า component พัง
src/Component.svelte    ← ตัว component จริง (UI, logic, export CSV/XLSX) — Svelte 3 syntax
schema.json             ← metadata: {} (ไม่มี svelteMajor)
rollup.config.js        ← external: [svelte, svelte/internal], globals: svelte / svelte_internal
```

โครงสร้างและ config ตรงกับ Budibase component skeleton ทางการ (tag v1.0.4 ก่อน migrate เป็น Svelte 5) 100%

## Changelog

- **v1.5.2** — เพิ่ม setting "Row number column alignment" ปรับการจัดวางคอลัมน์ลำดับได้เอง, เอา
  คอลัมน์เลขแถวสไตล์ spreadsheet (1 2 3 หน้าสุด) ที่ built-in อยู่ในตัว Preview ออก เพราะซ้ำซ้อนกับ
  คอลัมน์ลำดับจริงที่ตั้งผ่าน "Add row number column" ได้อยู่แล้ว
- **v1.4.2** — แก้บั๊กสีดำล้วนตอน export xlsx: จุดที่ resolve สี (CSS variable → hex) ย้ายจาก
  `document.body` มาไว้ใน DOM ของ component เอง เพื่อให้ได้ CSS variable scope ที่ถูกต้องตรงกับ Preview
- **v1.1.1** — เวอร์ชัน Demo แรก: ปุ่ม Design + Excel-like column designer, JS transform, CSV UTF-8 BOM
