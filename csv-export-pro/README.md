# CSV Export Pro

Custom **component plugin** สำหรับ Budibase (v3.4.0 ขึ้นไป, Svelte 3)
ที่ export ข้อมูลจาก data provider เป็นไฟล์ CSV โดย:

- เลือก **Data provider หรือ Table** ได้โดยตรง (ตั้งค่า setting เดียว รองรับทั้งสองคอมโพเนนต์)
- ออกแบบ **หัวคอลัมน์แบบ Excel** (Excel-like column designer) และแมปข้อมูลลงตามหัวที่ดีไซน์ไว้
- เขียนสูตรแปลงข้อมูลรายคอลัมน์ได้ทั้ง **JavaScript** และ **SQL** (`format: JS / SQL` ต่อคอลัมน์)
- **Merge & Center แบบ Excel** ในหน้า Print Preview: รวมหัวตารางข้ามคอลัมน์ (merge header) และรวมเซลล์ที่ค่าซ้ำกันตามแนวตั้ง (merge repeated rows) พร้อมจัดกึ่งกลาง/ชิดซ้าย/ชิดขวา
- **Print Preview**: กำหนด **เลขที่เอกสาร** และ **ลายน้ำ** (รองรับทั้ง URL รูปภาพและ base64 data URI) แล้วสั่งพิมพ์ได้ทันที
- Layout **fit-to-screen**: ถ้าตารางพอดีจอ จะขยายเต็มความกว้างอัตโนมัติ ถ้าคอลัมน์เยอะเกินไปจะ **ล็อกขนาดเดิมและเลื่อน (scroll) แทนการบีบคอลัมน์**
- Export เป็น **UTF-8 with BOM** → เปิดใน Excel แล้ว **ภาษาไทยไม่เพี้ยน** (แก้ปัญหา Windows-1252)
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
- `csv-export-pro-1.2.0.tar.gz` ← ไฟล์นี้ใช้ import เข้า Budibase

## Import เข้า Budibase

1. เปิด Budibase Portal → **Plugins** → **Add plugin**
2. เลือก Source เป็น **File Upload** แล้วอัปโหลด `dist/csv-export-pro-1.2.0.tar.gz`
   (หรือใช้ **GitHub / URL** ถ้า push repo ขึ้นไป)
3. เข้าแอป → ในรายการ component จะมีหมวด **Plugins → CSV Export Pro**

> พัฒนาแบบ live reload: ตั้ง env `PLUGINS_DIR`, รัน `budi hosting --start` แล้ว `npm run watch` ในโฟลเดอร์นี้

## วิธีใช้ในแอป

1. วาง **Data provider** หรือ **Table** แล้วเลือก datasource ที่ต้องการ export
2. วาง component **CSV Export Pro** (จะอยู่ในหรือใกล้ data provider/table ก็ได้)
3. ตั้งค่า setting → **Data provider / Table** ให้ชี้ไปที่คอมโพเนนต์นั้น (bind ได้ทั้ง Data Provider และ Table)
4. กดปุ่ม **Design** เพื่อเปิดตัวออกแบบหัวคอลัมน์แบบ Excel
   - แก้ชื่อหัวคอลัมน์, เลือก source field, เลือก format (`JS`/`SQL`) แล้วใส่ transform, เรียงลำดับ, เพิ่ม/ลบ
   - ตั้ง **Align** (ซ้าย/กึ่งกลาง/ขวา), **Merge header (cols)** (รวมหัวตารางข้ามคอลัมน์แบบ Excel merge & center),
     และ **Merge repeated rows** (รวมเซลล์ที่ค่าซ้ำกันต่อเนื่องกันในแนวตั้ง) — ใช้ในหน้า Print Preview
   - กด **Save design** เพื่อจำค่าไว้ (เก็บใน localStorage ตาม *Config key*)
5. กด **Export Csv** เพื่อดาวน์โหลดไฟล์ หรือกด **Print** เพื่อเปิด Print Preview แล้วสั่งพิมพ์

### Print Preview (merge & center, เลขที่เอกสาร, ลายน้ำ)

- เปิดจากปุ่ม **Print** (ซ่อน/แสดงได้ด้วย setting *Show Print Preview button*)
- แสดงตารางแบบ Excel: หัวตารางที่ตั้ง **Merge header** จะถูกรวมเป็นเซลล์เดียวและจัดกึ่งกลางตาม Align,
  คอลัมน์ที่ตั้ง **Merge repeated rows** จะรวมแถวที่ค่าซ้ำกันต่อเนื่องกันเป็นเซลล์เดียว
- ใส่ **เลขที่เอกสาร** (setting `documentNumber` + `documentNumberLabel`) และ **หัวเรื่อง** (`printTitle`) ได้
- ใส่ **ลายน้ำ** ผ่าน setting `watermarkSource` — รองรับทั้ง URL รูปภาพ (เช่น `https://.../logo.png`)
  และ base64 data URI (เช่น `data:image/png;base64,...`) ปรับความโปร่งใสได้ที่ `watermarkOpacity` (0–1)
- **Fit-to-screen**: ถ้าตารางกว้างพอดีกับจอ จะขยายเต็มความกว้างให้อัตโนมัติ
  ถ้าคอลัมน์เยอะเกินไปจนล้นจอ จะ **คงขนาดคอลัมน์เดิมไว้และเลื่อน (scroll) ในแนวนอนแทน** (ไม่บีบตัวหนังสือให้อ่านยาก)
- กด **🖨 Print** เพื่อเปิดหน้าต่างพิมพ์ของเบราว์เซอร์ (ซ่อนปุ่ม/ตัวควบคุมทั้งหมดตอนพิมพ์ด้วย `@media print`)

### ตัวอย่าง JS transform (format = JS)

```js
// ต่อหน่วยเงิน
value + ' บาท'

// จัดรูปแบบวันที่ไทย
helpers.date(value)            // helpers.date(value, 'en-US') ก็ได้

// ปัดทศนิยม 2 ตำแหน่ง
helpers.round(value, 2)

// รวมหลายฟิลด์ (source field เว้นว่างไว้ได้)
row.first_name + ' ' + row.last_name

// เขียนเป็น statement พร้อม return ก็ได้
if (!value) return '-'; return value.toUpperCase();
```

helpers ที่ใช้ได้: `upper`, `lower`, `trim`, `round(v, d)`, `number(v)`, `date(v, locale)`, `join(v, sep)`,
`concat(...)`, `coalesce(...)`, `like(v, pattern)`, `len(v)`, `substring(v, start, len)`

### ตัวอย่าง SQL transform (format = SQL)

```sql
-- IF/ELSE แบบ SQL
CASE WHEN value > 100 THEN 'High' ELSE 'Low' END

-- ต่อสตริงแบบ SQL (||)
first_name || ' ' || last_name

-- ฟังก์ชันสตริง/ตัวเลข
UPPER(value)
ROUND(value, 2)
COALESCE(value, 'N/A')

-- เงื่อนไข
amount > 100 AND status = 'paid'
value LIKE '25%'
value IS NULL
```

รองรับ: `CASE WHEN..THEN..ELSE..END`, `AND` `OR` `NOT`, `IS [NOT] NULL`, `LIKE`, `||` (concat),
เครื่องหมายเปรียบเทียบ/คำนวณทั่วไป และฟังก์ชัน `UPPER LOWER TRIM ROUND CONCAT COALESCE IFNULL LEN(GTH) SUBSTR(ING) ABS NOW`
— ตัวแปร `value` คือค่าคอลัมน์ปัจจุบัน ส่วนชื่อ field อื่น ๆ จะอ้างอิงจากแถวข้อมูลปัจจุบันโดยอัตโนมัติ

## Settings

| Setting | ความหมาย |
| --- | --- |
| Data provider / Table | แหล่งข้อมูล — ผูกได้ทั้ง Data Provider component และ Table component โดยตรง |
| Button text | ข้อความบนปุ่ม (ค่าเริ่มต้น `Export Csv`) |
| File name | ชื่อไฟล์ (ไม่ต้องใส่ `.csv`) |
| Delimiter | `,` / `;` / Tab |
| UTF-8 BOM | ใส่ BOM เพื่อให้ Excel อ่านไทยถูก (แนะนำเปิด) |
| Show column designer button | แสดงปุ่ม Design |
| Config key | คีย์สำหรับจำ design (ถ้าหลาย instance ให้ตั้งต่างกัน) |
| Button size | S / M / L |
| Show Print Preview button | แสดงปุ่ม Print |
| Print title | หัวเรื่องที่แสดงบนหน้า Print Preview |
| Document number | เลขที่เอกสาร (bind ค่าจาก binding ของ Budibase ได้) |
| Document number label | ป้ายกำกับเลขที่เอกสาร (ค่าเริ่มต้น `Document No.`) |
| Watermark (image URL or base64 data URI) | ลายน้ำที่แสดงกลางหน้า Print Preview รองรับ URL และ base64 |
| Watermark opacity (0-1) | ความโปร่งใสของลายน้ำ |
| On export | trigger action ของ Budibase หลัง export (context: `rowCount`, `fileName`) |

## หมายเหตุ

- Component จะ export **แถวที่ data provider โหลดมาให้** (ตาม pagination/limit ที่ตั้งไว้ที่ data provider)
  หากต้องการทั้งหมด ให้ตั้ง data provider ไม่จำกัดจำนวน หรือเปิด pagination ให้ครอบคลุม
- ใช้ได้กับ Budibase v3.4.0 ขึ้นไป (client เป็น Svelte 3) build ด้วย Svelte 3 แท้ (svelte ^3.49)


## โครงสร้างไฟล์ (v1.1.0 — Svelte 3)

```
index.js               ← entry point, ลงทะเบียนปลั๊กอิน, import Wrapper
lib/Wrapper.svelte      ← ห่อ Component ด้วย error boundary
lib/Boundary.js         ← createBoundary จาก @crownframework/svelte-error-boundary (Svelte 3)
lib/Boundary.svelte     ← UI แสดง error ถ้า component พัง
src/Component.svelte    ← ตัว component จริง (UI, logic, export CSV) — Svelte 3 syntax
schema.json             ← metadata: {} (ไม่มี svelteMajor)
rollup.config.js         ← external: [svelte, svelte/internal], globals: svelte / svelte_internal
```

โครงสร้างและ config ตรงกับ Budibase component skeleton ทางการ (tag v1.0.4 ก่อน migrate เป็น Svelte 5) 100%

## สรุปสาเหตุที่เคยพัง (แก้แล้วใน v1.1.0)

เวอร์ชันก่อนหน้า build โดยตั้งชื่อ global runtime ของ Svelte เป็น `svelteInternal` (แบบ Svelte 5)
แต่ Budibase 3.4.1 เป็น **Svelte 3** ซึ่ง expose runtime เป็น `svelte_internal` (มี underscore)
→ ปลั๊กอินเรียกหา `svelteInternal` ที่ไม่มีอยู่ จึง error `svelteInternal is not defined` และไม่ render

v1.1.0 build ด้วย Svelte 3 แท้ + globals ชื่อ `svelte`/`svelte_internal` ที่ถูกต้อง จึงรันได้

## ติดตั้ง

1. ลบปลั๊กอินเก่าออกจาก Portal → Plugins ให้หมดก่อน
2. Add plugin → File Upload → `dist/csv-export-pro-1.2.0.tar.gz`
3. Hard refresh (Ctrl/Cmd+Shift+R) แล้วเข้าแอปใหม่ ปุ่ม Export Csv + Design + Print จะแสดงบน canvas
