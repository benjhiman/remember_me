'use client';

import { useState } from 'react';
import { Folder, Pin, MoreVertical, X } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export interface ItemFolder {
  prefix: string;
  count: number;
  pinned: boolean;
}

interface ItemsFoldersGridProps {
  folders: ItemFolder[];
  onOpen: (prefix: string) => void;
  onUnpin?: (prefix: string) => void;
  canUnpin?: boolean;
}

export function ItemsFoldersGrid({ folders, onOpen, onUnpin, canUnpin = false }: ItemsFoldersGridProps) {
  const [selectedPrefix, setSelectedPrefix] = useState<string | null>(null);

  const handleDoubleClick = (prefix: string) => {
    onOpen(prefix);
  };

  const handleClick = (prefix: string) => {
    setSelectedPrefix(prefix);
  };

  if (folders.length === 0) {
    return (
      <div className="p-12 text-center">
        <div className="max-w-sm mx-auto">
          <Folder className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-sm font-semibold text-gray-900 mb-1">No hay carpetas</h3>
          <p className="text-xs text-gray-600">No hay items con SKU para mostrar carpetas.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
      {folders.map((folder) => (
        <div
          key={folder.prefix}
          className={cn(
            'relative group bg-white border border-gray-200 rounded-lg p-4 cursor-pointer transition-all hover:shadow-md hover:border-gray-300',
            selectedPrefix === folder.prefix && 'ring-2 ring-primary ring-offset-2',
          )}
          onClick={() => handleClick(folder.prefix)}
          onDoubleClick={() => handleDoubleClick(folder.prefix)}
        >
          {/* Pinned indicator */}
          {folder.pinned && (
            <div className="absolute top-2 right-2">
              <Pin className="h-4 w-4 text-yellow-500 fill-yellow-500" />
            </div>
          )}

          {/* Unpin button (only for pinned folders) */}
          {folder.pinned && canUnpin && onUnpin && (
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={(e) => {
                      e.stopPropagation();
                    }}
                  >
                    <MoreVertical className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      onUnpin(folder.prefix);
                    }}
                    className="text-destructive"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Desanclar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}

          {/* Folder icon */}
          <div className="flex items-center justify-center mb-3">
            <Folder className="h-12 w-12 text-gray-400 group-hover:text-primary transition-colors" />
          </div>

          {/* Prefix name */}
          <div className="text-center">
            <h3 className="text-sm font-semibold text-gray-900 mb-1">{folder.prefix}</h3>
            <Badge variant="secondary" className="text-xs">
              {folder.count} {folder.count === 1 ? 'item' : 'items'}
            </Badge>
          </div>

          {/* Double-click hint */}
          <p className="text-xs text-gray-500 text-center mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
            Doble click para abrir
          </p>
        </div>
      ))}
    </div>
  );
}
