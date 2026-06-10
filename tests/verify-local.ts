import fs from 'fs';
import path from 'path';

async function run() {
  try {
    const filePath = 'C:/Users/ElTig/.gemini/antigravity-ide/brain/b968bf38-3164-4024-ac99-72184da8fb22/.system_generated/steps/369/content.md';
    if (!fs.existsSync(filePath)) {
      console.error("File not found at:", filePath);
      return;
    }
    
    const raw = fs.readFileSync(filePath, 'utf8');
    // The content may contain markdown formatting around the JSON, let's extract the JSON block if any
    let jsonStr = raw.trim();
    if (jsonStr.startsWith('```json')) {
      jsonStr = jsonStr.substring(7, jsonStr.length - 3).trim();
    } else if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.substring(3, jsonStr.length - 3).trim();
    }

    const stocks = JSON.parse(jsonStr);
    console.log(`Verified local stocks array:`);
    console.log(`  Total stocks count: ${stocks.length}`);
    
    const rhhbf = stocks.find((s: any) => s.symbol === 'RHHBF');
    const hbcyf = stocks.find((s: any) => s.symbol === 'HBCYF');
    console.log(`  Is RHHBF present? ${!!rhhbf}`);
    console.log(`  Is HBCYF present? ${!!hbcyf}`);
    
    console.log(`  First 10 stocks symbols:`, stocks.slice(0, 10).map((s: any) => s.symbol).join(', '));
    console.log(`  Last 5 stocks symbols:`, stocks.slice(-5).map((s: any) => s.symbol).join(', '));
  } catch (e: any) {
    console.error("Verification failed:", e);
  }
}
run();
