'use client';

import { useState } from 'react';
import { Folder, X } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export interface ItemFolder {
  id: string;
  name: string;
  description?: string | null;
  count: number;
  createdAt: string;
  updatedAt: string;
}

interface ItemsFoldersGridProps {
  folders: ItemFolder[];
  onOpen: (folderId: string) => void;
  onDelete?: (folderId: string) => void;
  canDelete?: boolean;
  viewMode?: 'grid' | 'list';
}

export function ItemsFoldersGrid({ folders, onOpen, onDelete, canDelete = false, viewMode = 'grid' }: ItemsFoldersGridProps) {
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);

  const handleDoubleClick = (folderId: string) => {
    onOpen(folderId);
  };

  const handleClick = (folderId: string) => {
    setSelectedFolderId(folderId);
  };

  if (viewMode === 'list') {
    return (
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Nombre
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Items
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Descripción
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {folders.map((folder) => (
              <tr
                key={folder.id}
                className={cn(
                  'hover:bg-gray-50 cursor-pointer',
                  selectedFolderId === folder.id && 'bg-blue-50',
                )}
                onClick={() => handleClick(folder.id)}
                onDoubleClick={() => handleDoubleClick(folder.id)}
              >
                <td className="px-4 py-3 whitespace-nowrap">
                  <div className="flex items-center">
                    <Folder className="h-5 w-5 text-gray-400 mr-2" />
                    <div className="text-sm font-medium text-gray-900">{folder.name}</div>
                  </div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <Badge variant="secondary" className="text-xs">
                    {folder.count} {folder.count === 1 ? 'item' : 'items'}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <div className="text-sm text-gray-600">{folder.description || '-'}</div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                  {canDelete && onDelete && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:text-red-900"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(folder.id);
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

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
          key={folder.id}
          className={cn(
            'relative group bg-white border border-gray-200 rounded-lg p-4 cursor-pointer transition-all hover:shadow-md hover:border-gray-300',
            selectedFolderId === folder.id && 'ring-2 ring-primary ring-offset-2',
          )}
          onClick={() => handleClick(folder.id)}
          onDoubleClick={() => handleDoubleClick(folder.id)}
        >
          {/* Delete button */}
          {canDelete && onDelete && (
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-red-600 hover:text-red-900"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(folder.id);
                }}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          )}

          {/* Folder icon */}
          <div className="flex items-center justify-center mb-3">
            <Folder className="h-12 w-12 text-gray-400 group-hover:text-primary transition-colors" />
          </div>

          {/* Folder name */}
          <div className="text-center">
            <h3 className="text-sm font-semibold text-gray-900 mb-1">{folder.name}</h3>
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
