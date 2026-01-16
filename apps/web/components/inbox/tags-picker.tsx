'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import type { ConversationTag } from '@/types/api';

interface TagBasic {
  id: string;
  name: string;
  color?: string;
}

interface TagsPickerProps {
  conversationId: string;
  currentTags: TagBasic[];
  onTagAdded: (tagId: string) => void;
  onTagRemoved: (tagId: string) => void;
}

export function TagsPicker({ conversationId, currentTags, onTagAdded, onTagRemoved }: TagsPickerProps) {
  const [allTags, setAllTags] = useState<ConversationTag[]>([]);
  const [loading, setLoading] = useState(false);
  const [showPicker, setShowPicker] = useState(false);

  useEffect(() => {
    loadTags();
  }, []);

  const loadTags = async () => {
    try {
      const response = await api.get<{ data: ConversationTag[] }>('/inbox/tags');
      setAllTags(response.data || []);
    } catch (error) {
      console.error('Error loading tags:', error);
    }
  };

  const handleAddTag = async (tagId: string) => {
    if (currentTags.some((t) => t.id === tagId)) return;

    setLoading(true);
    try {
      await api.post(`/inbox/conversations/${conversationId}/tags/${tagId}`);
      onTagAdded(tagId);
    } catch (error) {
      console.error('Error adding tag:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveTag = async (tagId: string) => {
    setLoading(true);
    try {
      await api.delete(`/inbox/conversations/${conversationId}/tags/${tagId}`);
      onTagRemoved(tagId);
    } catch (error) {
      console.error('Error removing tag:', error);
    } finally {
      setLoading(false);
    }
  };

  const availableTags = allTags.filter((tag) => !currentTags.some((t) => t.id === tag.id));

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setShowPicker(!showPicker)}
        disabled={loading}
      >
        {showPicker ? 'Ocultar' : 'Gestionar etiquetas'}
      </Button>

      {showPicker && (
        <div className="absolute z-10 mt-2 bg-white border rounded-lg shadow-lg p-4 min-w-[300px]">
          <div className="mb-3">
            <h4 className="text-sm font-medium mb-2">Etiquetas actuales</h4>
            {currentTags.length === 0 ? (
              <p className="text-xs text-gray-500">Sin etiquetas</p>
            ) : (
              <div className="flex flex-wrap gap-1">
                {currentTags.map((tag) => (
                  <span
                    key={tag.id}
                    className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border"
                    style={{
                      backgroundColor: tag.color ? `${tag.color}20` : '#f3f4f6',
                      color: tag.color || '#6b7280',
                      borderColor: tag.color ? `${tag.color}40` : '#d1d5db',
                    }}
                  >
                    {tag.name}
                    <button
                      onClick={() => handleRemoveTag(tag.id)}
                      className="hover:text-red-600"
                      disabled={loading}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {availableTags.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-2">Agregar etiqueta</h4>
              <div className="flex flex-wrap gap-1">
                {availableTags.map((tag) => (
                  <button
                    key={tag.id}
                    onClick={() => handleAddTag(tag.id)}
                    className="text-xs px-2 py-1 rounded border hover:bg-gray-50"
                    style={{
                      backgroundColor: tag.color ? `${tag.color}10` : '#ffffff',
                      color: tag.color || '#6b7280',
                      borderColor: tag.color ? `${tag.color}40` : '#d1d5db',
                    }}
                    disabled={loading}
                  >
                    + {tag.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
