# CSV Export Pro

Custom **component plugin** สำหรับ Budibase (v3.4.0 ขึ้นไป, Svelte 3)
ที่ export ข้อมูลจาก data provider เป็นไฟล์ CSV โดย:

- เลือก **Data provider / Table** ได้ (ผูกกับ data provider ที่ชี้ไปยัง table ที่ต้องการ)
- ออกแบบ **หัวคอลัมน์แบบ Excel** (Excel-like column designer) และแมปข้อมูลลงตามหัวที่ดีไซน์ไว้
- เขียน **JavaScript แปลงข้อมูลรายคอลัมน์** ได้ (`value`, `row`, `index`, `helpers`)
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
- `csv-export-pro-1.1.1.tar.gz` ← ไฟล์นี้ใช้ import เข้า Budibase

## Import เข้า Budibase

1. เปิด Budibase Portal → **Plugins** → **Add plugin**
2. เลือก Source เป็น **File Upload** แล้วอัปโหลด `dist/csv-export-pro-1.1.1.tar.gz`
   (หรือใช้ **GitHub / URL** ถ้า push repo ขึ้นไป)
3. เข้าแอป → ในรายการ component จะมีหมวด **Plugins → CSV Export Pro**

> พัฒนาแบบ live reload: ตั้ง env `PLUGINS_DIR`, รัน `budi hosting --start` แล้ว `npm run watch` ในโฟลเดอร์นี้

## วิธีใช้ในแอป

1. วาง **Data provider** แล้วเลือก datasource เป็น table ที่ต้องการ export
2. วาง component **CSV Export Pro** (จะอยู่ในหรือใกล้ data provider ก็ได้)
3. ตั้งค่า setting → **Data provider** ให้ชี้ไปที่ data provider นั้น
4. กดปุ่ม **Design** เพื่อเปิดตัวออกแบบหัวคอลัมน์แบบ Excel
   - แก้ชื่อหัวคอลัมน์, เลือก source field, ใส่ JS transform, เรียงลำดับ, เพิ่ม/ลบ
   - กด **Save design** เพื่อจำค่าไว้ (เก็บใน localStorage ตาม *Config key*)
5. กด **Export Csv** เพื่อดาวน์โหลดไฟล์

### ตัวอย่าง JS transform (ช่อง Transform)

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

helpers ที่ใช้ได้: `upper`, `lower`, `trim`, `round(v, d)`, `number(v)`, `date(v, locale)`, `join(v, sep)`

## Settings

| Setting | ความหมาย |
| --- | --- |
| Data provider | แหล่งข้อมูล (ผูก table ผ่าน data provider) |
| Button text | ข้อความบนปุ่ม (ค่าเริ่มต้น `Export Csv`) |
| File name | ชื่อไฟล์ (ไม่ต้องใส่ `.csv`) |
| Delimiter | `,` / `;` / Tab |
| UTF-8 BOM | ใส่ BOM เพื่อให้ Excel อ่านไทยถูก (แนะนำเปิด) |
| Show column designer button | แสดงปุ่ม Design |
| Config key | คีย์สำหรับจำ design (ถ้าหลาย instance ให้ตั้งต่างกัน) |
| Button size | S / M / L |
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
2. Add plugin → File Upload → `dist/csv-export-pro-1.1.1.tar.gz`
3. Hard refresh (Ctrl/Cmd+Shift+R) แล้วเข้าแอปใหม่ ปุ่ม Export Csv + Design จะแสดงบน canvas
