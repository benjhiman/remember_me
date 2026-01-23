'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { api } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { IntegrationProvider } from '@/types/api';

interface WhatsAppTemplateComponent {
  type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS';
  text?: string;
  format?: 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT';
  buttons?: Array<{ type: string; text?: string; url?: string }>;
}

interface WhatsAppTemplate {
  id: string;
  name: string;
  category: string;
  language: string;
  status: string;
  componentsJson?: WhatsAppTemplateComponent[];
}

interface TemplatePickerProps {
  provider: IntegrationProvider;
  onSelect: (templateId: string, variables?: Record<string, string>) => void;
  disabled?: boolean;
}

export function TemplatePicker({ provider, onSelect, disabled }: TemplatePickerProps) {
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<WhatsAppTemplate | null>(null);
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (showPicker && provider === 'WHATSAPP') {
      loadTemplates();
    }
  }, [showPicker, provider]);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const response = await api.get<{ data: WhatsAppTemplate[] }>(
        '/integrations/whatsapp/templates?status=APPROVED'
      );
      setTemplates(response.data || []);
    } catch (error) {
      console.error('Error loading templates:', error);
    } finally {
      setLoading(false);
    }
  };

  // Extract placeholders from template text ({{1}}, {{2}}, etc.)
  const extractPlaceholders = (text: string): number[] => {
    const matches = text.match(/\{\{(\d+)\}\}/g);
    if (!matches) return [];
    return matches
      .map((match) => parseInt(match.replace(/\{\{|\}\}/g, ''), 10))
      .filter((num, index, arr) => arr.indexOf(num) === index) // Unique
      .sort((a, b) => a - b);
  };

  // Get all required variable indices from template
  const getRequiredVariables = useCallback((template: WhatsAppTemplate): number[] => {
    const indices: number[] = [];
    template.componentsJson?.forEach((comp) => {
      if ((comp.type === 'BODY' || comp.type === 'HEADER') && comp.text) {
        const placeholders = extractPlaceholders(comp.text);
        placeholders.forEach((idx) => {
          if (!indices.includes(idx)) {
            indices.push(idx);
          }
        });
      }
    });
    return indices.sort((a, b) => a - b);
  }, []);

  // Render preview with variables replaced
  const renderPreview = (template: WhatsAppTemplate, vars: Record<string, string>): string => {
    let preview = '';
    template.componentsJson?.forEach((comp) => {
      if (comp.type === 'HEADER' && comp.text) {
        let headerText = comp.text;
        const headerPlaceholders = extractPlaceholders(headerText);
        headerPlaceholders.forEach((idx) => {
          const varKey = `var${idx}`;
          headerText = headerText.replace(
            new RegExp(`\\{\\{${idx}\\}\\}`, 'g'),
            vars[varKey] || `{{${idx}}}`
          );
        });
        preview += `*${headerText}*\n\n`;
      }
      if (comp.type === 'BODY' && comp.text) {
        let bodyText = comp.text;
        const bodyPlaceholders = extractPlaceholders(bodyText);
        bodyPlaceholders.forEach((idx) => {
          const varKey = `var${idx}`;
          bodyText = bodyText.replace(
            new RegExp(`\\{\\{${idx}\\}\\}`, 'g'),
            vars[varKey] || `{{${idx}}}`
          );
        });
        preview += bodyText;
      }
      if (comp.type === 'FOOTER' && comp.text) {
        preview += `\n\n_${comp.text}_`;
      }
    });
    return preview.trim();
  };

  const handleSelectTemplate = (template: WhatsAppTemplate) => {
    setSelectedTemplate(template);
    const requiredVars = getRequiredVariables(template);
    const vars: Record<string, string> = {};
    requiredVars.forEach((idx) => {
      vars[`var${idx}`] = '';
    });
    setVariables(vars);
  };

  const handleVariableChange = (varKey: string, value: string) => {
    setVariables({ ...variables, [varKey]: value });
  };

  const canSend = useMemo(() => {
    if (!selectedTemplate) return false;
    const requiredVars = getRequiredVariables(selectedTemplate);
    return requiredVars.every((idx) => {
      const varKey = `var${idx}`;
      return variables[varKey] && variables[varKey].trim().length > 0;
    });
  }, [selectedTemplate, variables, getRequiredVariables]);

  const handleSend = () => {
    if (selectedTemplate && canSend) {
      // Convert var1, var2, etc. to ordered array for API
      const requiredVars = getRequiredVariables(selectedTemplate);
      const orderedVars: Record<string, string> = {};
      requiredVars.forEach((idx) => {
        const varKey = `var${idx}`;
        orderedVars[`${idx}`] = variables[varKey];
      });
      onSelect(selectedTemplate.id, orderedVars);
      setShowPicker(false);
      setSelectedTemplate(null);
      setVariables({});
      setSearchQuery('');
    }
  };

  // Filter templates by search query
  const filteredTemplates = useMemo(() => {
    if (!searchQuery.trim()) return templates;
    const query = searchQuery.toLowerCase();
    return templates.filter(
      (t) =>
        t.name.toLowerCase().includes(query) ||
        t.category.toLowerCase().includes(query)
    );
  }, [templates, searchQuery]);

  if (provider !== 'WHATSAPP') {
    return null; // Templates only for WhatsApp
  }

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setShowPicker(!showPicker)}
        disabled={disabled}
      >
        {showPicker ? 'Ocultar' : 'Usar plantilla'}
      </Button>

      {showPicker && (
        <div className="absolute z-10 mt-2 bg-white border rounded-lg shadow-lg p-4 min-w-[500px] max-h-[600px] overflow-y-auto">
          {loading ? (
            <p className="text-sm text-gray-500">Cargando plantillas...</p>
          ) : selectedTemplate ? (
            <div>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h4 className="text-sm font-medium">{selectedTemplate.name}</h4>
                  <p className="text-xs text-gray-500">
                    {selectedTemplate.category} • {selectedTemplate.language}
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setSelectedTemplate(null)}>
                  ← Volver
                </Button>
              </div>

              {/* Variables Input */}
              {Object.keys(variables).length > 0 && (
                <div className="mb-4 space-y-3">
                  <p className="text-xs font-medium text-gray-700">Completa las variables:</p>
                  {Object.keys(variables)
                    .sort()
                    .map((varKey) => {
                      const idx = parseInt(varKey.replace('var', ''), 10);
                      return (
                        <div key={varKey}>
                          <label className="block text-xs font-medium mb-1">
                            Variable {idx}:
                          </label>
                          <Input
                            type="text"
                            value={variables[varKey]}
                            onChange={(e) => handleVariableChange(varKey, e.target.value)}
                            placeholder={`Valor para variable ${idx}`}
                            className="text-sm"
                          />
                        </div>
                      );
                    })}
                </div>
              )}

              {/* Preview */}
              {selectedTemplate && (
                <div className="mb-4 p-3 bg-gray-50 rounded border">
                  <p className="text-xs font-medium text-gray-700 mb-2">Vista previa:</p>
                  <div className="text-sm whitespace-pre-wrap text-gray-800">
                    {renderPreview(selectedTemplate, variables)}
                  </div>
                </div>
              )}

              {/* Validation Message */}
              {!canSend && Object.keys(variables).length > 0 && (
                <p className="text-xs text-red-600 mb-2">
                  ⚠️ Completa todas las variables requeridas para enviar
                </p>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleSend}
                  disabled={!canSend}
                  className="flex-1"
                >
                  Enviar plantilla
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedTemplate(null);
                    setVariables({});
                  }}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          ) : (
            <div>
              <h4 className="text-sm font-medium mb-3">Seleccionar plantilla</h4>
              
              {/* Search */}
              <Input
                type="text"
                placeholder="Buscar por nombre o categoría..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="mb-3 text-sm"
              />

              {filteredTemplates.length === 0 ? (
                <p className="text-sm text-gray-500">
                  {searchQuery ? 'No se encontraron plantillas' : 'No hay plantillas disponibles'}
                </p>
              ) : (
                <div className="space-y-1 max-h-[400px] overflow-y-auto">
                  {filteredTemplates.map((template) => (
                    <button
                      key={template.id}
                      onClick={() => handleSelectTemplate(template)}
                      className="w-full text-left text-sm px-3 py-2 rounded border hover:bg-gray-50 transition-colors"
                    >
                      <div className="font-medium">{template.name}</div>
                      <div className="text-xs text-gray-500">
                        {template.category} • {template.language}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
