/**
 * File import parser for bulk stock addition
 * Supports CSV and Excel (.xlsx) files
 */

import Papa from 'papaparse';

export interface ImportRow {
  query: string;
  quantity: number;
  raw: string; // Original row data for preview
}

export interface ColumnDetection {
  modelKey: string;
  qtyKey: string;
}

/**
 * Detect model and quantity columns from headers
 */
export function detectColumns(headers: string[]): ColumnDetection | null {
  const normalizedHeaders = headers.map((h) => (h || '').toLowerCase().trim());

  const modelKeys = ['model', 'modelo', 'descripcion', 'description', 'sku', 'item', 'name', 'producto', 'product'];
  const qtyKeys = ['quantity', 'cantidad', 'qty', 'q', 'cant', 'unidades', 'units'];

  let modelKey: string | null = null;
  let qtyKey: string | null = null;

  // Find model column
  for (const header of normalizedHeaders) {
    if (modelKeys.some((key) => header.includes(key) || key.includes(header))) {
      const originalIndex = normalizedHeaders.indexOf(header);
      modelKey = headers[originalIndex];
      break;
    }
  }

  // Find quantity column
  for (const header of normalizedHeaders) {
    if (qtyKeys.some((key) => header.includes(key) || key.includes(header))) {
      const originalIndex = normalizedHeaders.indexOf(header);
      qtyKey = headers[originalIndex];
      break;
    }
  }

  if (modelKey && qtyKey) {
    return { modelKey, qtyKey };
  }

  return null;
}

/**
 * Parse CSV file
 */
export async function parseCsvFile(file: File): Promise<ImportRow[]> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        try {
          const rows: ImportRow[] = [];
          const data = results.data as any[];

          if (data.length === 0) {
            resolve([]);
            return;
          }

          // Try to detect columns from first row
          const firstRow = data[0];
          const headers = Object.keys(firstRow);
          const detected = detectColumns(headers);

          if (!detected) {
            // Fallback: use first two columns (A and B)
            const colA = headers[0] || 'A';
            const colB = headers[1] || 'B';
            for (const row of data) {
              const query = String(row[colA] || '').trim();
              const qtyStr = String(row[colB] || '').trim().replace(/[,.]$/, '');
              const quantity = parseInt(qtyStr, 10);

              if (query && !isNaN(quantity) && quantity >= 1) {
                rows.push({
                  query: query.toUpperCase(),
                  quantity,
                  raw: `${query} ${quantity}`,
                });
              }
            }
          } else {
            // Use detected columns
            for (const row of data) {
              const query = String(row[detected.modelKey] || '').trim();
              const qtyStr = String(row[detected.qtyKey] || '').trim().replace(/[,.]$/, '');
              const quantity = parseInt(qtyStr, 10);

              if (query && !isNaN(quantity) && quantity >= 1) {
                rows.push({
                  query: query.toUpperCase(),
                  quantity,
                  raw: `${query} ${quantity}`,
                });
              }
            }
          }

          resolve(rows);
        } catch (error) {
          reject(error);
        }
      },
      error: (error) => {
        reject(error);
      },
    });
  });
}

/**
 * Parse Excel (.xlsx) file
 */
export async function parseXlsxFile(file: File): Promise<ImportRow[]> {
  const XLSX = await import('xlsx');

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });

        // Get first sheet
        const firstSheetName = workbook.SheetNames[0];
        if (!firstSheetName) {
          resolve([]);
          return;
        }

        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

        if (jsonData.length === 0) {
          resolve([]);
          return;
        }

        const rows: ImportRow[] = [];

        // Check if first row looks like headers
        const firstRow = jsonData[0] as any[];
        const isHeaderRow = firstRow.some((cell) => {
          const cellStr = String(cell || '').toLowerCase();
          return ['model', 'modelo', 'descripcion', 'quantity', 'cantidad', 'qty'].some((key) =>
            cellStr.includes(key),
          );
        });

        let startIndex = 0;
        let modelColIndex = 0;
        let qtyColIndex = 1;

        if (isHeaderRow) {
          // Has headers - detect columns
          const headers = firstRow.map((h) => String(h || ''));
          const detected = detectColumns(headers);
          if (detected) {
            modelColIndex = headers.indexOf(detected.modelKey);
            qtyColIndex = headers.indexOf(detected.qtyKey);
          }
          startIndex = 1; // Skip header row
        } else {
          // No headers - use A and B columns (0 and 1)
          modelColIndex = 0;
          qtyColIndex = 1;
        }

        // Process data rows
        for (let i = startIndex; i < jsonData.length; i++) {
          const row = jsonData[i] as any[];
          if (!row || row.length === 0) continue;

          const query = String(row[modelColIndex] || '').trim();
          const qtyValue = row[qtyColIndex];

          // Handle both string and number quantities
          let qtyStr: string;
          if (typeof qtyValue === 'number') {
            qtyStr = String(qtyValue);
          } else {
            qtyStr = String(qtyValue || '').trim().replace(/[,.]$/, '');
          }

          const quantity = parseInt(qtyStr, 10);

          if (query && !isNaN(quantity) && quantity >= 1) {
            rows.push({
              query: query.toUpperCase(),
              quantity,
              raw: `${query} ${quantity}`,
            });
          }
        }

        resolve(rows);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => {
      reject(new Error('Error reading file'));
    };

    reader.readAsArrayBuffer(file);
  });
}

/**
 * Parse file (CSV or Excel) based on extension
 */
export async function parseFile(file: File): Promise<ImportRow[]> {
  const fileName = file.name.toLowerCase();
  const extension = fileName.split('.').pop();

  if (extension === 'csv') {
    return parseCsvFile(file);
  } else if (extension === 'xlsx' || extension === 'xls') {
    return parseXlsxFile(file);
  } else {
    throw new Error(`Formato de archivo no soportado: ${extension}. Use CSV o XLSX.`);
  }
}
