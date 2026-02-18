'use client';

import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { PriceListItem } from '@/lib/api/hooks/use-price-lists';

interface GenerateWhatsAppListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  priceListName: string;
  items: PriceListItem[];
}

// Category mapping based on displayName patterns
function getCategory(item: PriceListItem): string {
  const name = item.displayName.toUpperCase();
  
  // VAPES
  if (name.includes('VAPE') || name.includes('TYSON') || name.includes('ROUND')) {
    return 'VAPES';
  }
  
  // GAMER / CONSOLAS
  if (name.includes('PLAYSTATION') || name.includes('PS5') || name.includes('JOYSTICK') || 
      name.includes('NINTENDO') || name.includes('SWITCH') || name.includes('META QUEST') || 
      name.includes('RAYBAN') || name.includes('META')) {
    return 'GAMER';
  }
  
  // SAMSUNG
  if (name.includes('SAMSUNG')) {
    if (name.includes('A06') || name.includes('A07') || name.includes('A16') || 
        name.includes('A17') || name.includes('A56')) {
      return 'SAMSUNG_GAMA_A';
    }
    if (name.includes('S25')) {
      return 'SAMSUNG_S25';
    }
    return 'SAMSUNG_OTHER';
  }
  
  // APPLE - IPHONE
  if (name.includes('IPHONE')) {
    if (name.includes('OEM')) {
      return 'IPHONE_OEM';
    }
    return 'IPHONE';
  }
  
  // APPLE - IPAD
  if (name.includes('IPAD')) {
    return 'IPAD';
  }
  
  // APPLE - MAC
  if (name.includes('MAC') || name.includes('MACBOOK') || name.includes('NOTEBOOK')) {
    return 'MAC';
  }
  
  // APPLE - ACCESORIOS
  if (name.includes('AIRPODS') || name.includes('AIRPOD') || name.includes('AIRTAG') || 
      name.includes('APPLE PENCIL') || name.includes('APPLE WATCH') || name.includes('WATCH') ||
      name.includes('MAGIC MOUSE') || name.includes('CARGADOR')) {
    return 'ACCESORIOS';
  }
  
  return 'OTHER';
}

function formatPrice(price: number | null | undefined): string {
  if (price === null || price === undefined) return '';
  return `$${price.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatItemName(displayName: string): string {
  // Remove brand if it's at the start
  let name = displayName.replace(/^APPLE\s+/i, '');
  name = name.replace(/^SAMSUNG\s+/i, '');
  
  // Format iPhone models - keep numbers and storage/condition
  if (name.match(/^IPHONE\s+/i)) {
    name = name.replace(/^IPHONE\s+/i, '');
    // Format: "12 128GB NEW" -> "12 128Gb" or "iPhone 12 128GB"
    name = name.replace(/\s+(NEW|USED|OEM)$/i, '');
    name = name.replace(/GB/i, 'Gb');
    // If starts with number, add "iPhone" prefix
    if (name.match(/^\d{1,2}\s/)) {
      name = `iPhone ${name}`;
    } else if (name.match(/^(\d{1,2}\s|PRO|PRO\sMAX|PLUS|AIR)/i)) {
      name = `iPhone ${name}`;
    }
  }
  
  // Format iPad
  if (name.match(/^IPAD\s+/i)) {
    name = name.replace(/^IPAD\s+/i, '');
    name = name.replace(/\s+(NEW|USED|OEM)$/i, '');
    name = name.replace(/GB/i, 'GB');
    if (!name.match(/^IPAD/i)) {
      name = `IPad ${name}`;
    }
  }
  
  // Format Mac
  if (name.match(/^MAC/i)) {
    name = name.replace(/^MAC\s+/i, '');
    name = name.replace(/MACBOOK\s+/i, '');
    name = name.replace(/\s+(NEW|USED|OEM)$/i, '');
    name = name.replace(/GB/i, 'GB');
    if (name.match(/^M\d/)) {
      name = `MAC ${name}`;
    } else {
      name = `MAC ${name}`;
    }
  }
  
  // Format Samsung
  if (name.match(/^S25/i)) {
    name = name.replace(/\s+(NEW|USED|OEM)$/i, '');
    name = name.replace(/GB/i, 'GB');
  }
  
  // Remove condition suffix if still present
  name = name.replace(/\s+(NEW|USED|OEM)$/i, '');
  
  // Fix GB capitalization
  name = name.replace(/gb/i, 'GB');
  name = name.replace(/Gb/g, 'GB');
  
  return name;
}

export function GenerateWhatsAppListDialog({
  open,
  onOpenChange,
  priceListName,
  items,
}: GenerateWhatsAppListDialogProps) {
  const [listName, setListName] = useState(priceListName);
  const [generatedText, setGeneratedText] = useState('');

  const categoryLabels: Record<string, { title: string; emoji: string }> = {
    VAPES: { title: 'VAPES', emoji: '🥇' },
    GAMER: { title: '🎯 GAMER\n🎮 CONSOLAS 🕹️', emoji: '' },
    SAMSUNG_GAMA_A: { title: '📲 SAMSUNG GAMA A 📱', emoji: '' },
    SAMSUNG_S25: { title: '📱 SERIE S25 📱', emoji: '' },
    SAMSUNG_OTHER: { title: '📱 SAMSUNG', emoji: '' },
    IPHONE: { title: '📱 CELULARES APPLE', emoji: '' },
    IPHONE_OEM: { title: '🍎 LISTA DE PRECIOS IPHONE OEM', emoji: '' },
    IPAD: { title: '💻🍏🖥 IPAD:', emoji: '' },
    MAC: { title: '💻🍏🖥 Notebooks:', emoji: '' },
    ACCESORIOS: { title: '⌚️🎧 ACCESORIOS ORIGINALES 🔌🍏', emoji: '' },
    OTHER: { title: 'OTROS', emoji: '' },
  };

  const groupedItems = useMemo(() => {
    const groups: Record<string, PriceListItem[]> = {};
    
    items.forEach((item) => {
      const category = getCategory(item);
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(item);
    });

    // Sort items within each category by displayName
    Object.keys(groups).forEach((key) => {
      groups[key].sort((a, b) => a.displayName.localeCompare(b.displayName));
    });

    return groups;
  }, [items]);

  const generateList = () => {
    let text = `🔥📲 LISTA DE PRECIOS ACTUALIZADA – ${listName.toUpperCase()}\n`;
    text += `💰 ACEPTAMOS USDT\n`;
    text += `🚚 Entrega inmediata – Stock limitado\n\n`;
    text += `💰ACEPTAMOS USDT💰\n\n\n`;

    // Order categories
    const categoryOrder = [
      'VAPES',
      'GAMER',
      'SAMSUNG_GAMA_A',
      'SAMSUNG_S25',
      'SAMSUNG_OTHER',
      'IPHONE',
      'IPHONE_OEM',
      'IPAD',
      'MAC',
      'ACCESORIOS',
      'OTHER',
    ];

    categoryOrder.forEach((category) => {
      const categoryItems = groupedItems[category];
      if (!categoryItems || categoryItems.length === 0) return;

      const categoryInfo = categoryLabels[category] || { title: category, emoji: '' };
      text += `${categoryInfo.title}\n`;

      // Special formatting for certain categories
      if (category === 'IPHONE_OEM') {
        text += `UNICOS IMPORTADOR EN 🇦🇷\n`;
        text += `EQUIPOS ORIGINALES SIN DETALLES  🥇\n\n`;
      }

      categoryItems.forEach((item) => {
        const price = formatPrice(item.basePrice);
        if (!price) return; // Skip items without price

        const formattedName = formatItemName(item.displayName);
        // Use tab for alignment, but ensure proper spacing
        text += `- ${formattedName}\t${price}\n`;
      });

      text += `\n\n`;
    });

    setGeneratedText(text);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedText);
  };

  const handleDownload = () => {
    const blob = new Blob([generatedText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lista-precios-${listName.toLowerCase().replace(/\s+/g, '-')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Generar Lista para WhatsApp</DialogTitle>
          <DialogDescription>
            Generá una lista formateada para compartir por WhatsApp.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="listName">
              Nombre de la lista <span className="text-destructive">*</span>
            </Label>
            <Input
              id="listName"
              value={listName}
              onChange={(e) => setListName(e.target.value)}
              placeholder="Ej: Berlin, Mayorista, etc."
            />
          </div>

          <Button onClick={generateList} disabled={!listName.trim()}>
            Generar Lista
          </Button>

          {generatedText && (
            <div className="space-y-2">
              <Label>Lista generada:</Label>
              <Textarea
                value={generatedText}
                readOnly
                className="min-h-[400px] font-mono text-sm"
              />
              <div className="flex gap-2">
                <Button onClick={handleCopy} variant="outline">
                  Copiar al portapapeles
                </Button>
                <Button onClick={handleDownload} variant="outline">
                  Descargar como .txt
                </Button>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
