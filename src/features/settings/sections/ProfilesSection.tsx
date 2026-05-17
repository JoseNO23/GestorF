import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Check, X, Pencil, Trash2, LogIn } from 'lucide-react';
import * as cmd from '../../../domain-client/commands';
import type { Profile } from '../../../domain-client/types';

export default function ProfilesSection() {
  const qc = useQueryClient();
  const [newName, setNewName] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [error, setError] = useState('');

  const { data: profiles = [] } = useQuery({
    queryKey: ['profiles'],
    queryFn: cmd.listProfiles,
  });

  const { data: activeId = '' } = useQuery({
    queryKey: ['active-profile'],
    queryFn: cmd.getActiveProfileId,
  });

  const createMutation = useMutation({
    mutationFn: () => cmd.createProfile(newName.trim()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['profiles'] });
      setNewName('');
      setShowForm(false);
      setError('');
    },
    onError: (e: unknown) => setError(typeof e === 'string' ? e : (e as Error).message),
  });

  const renameMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      cmd.renameProfile(id, name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['profiles'] });
      setEditingId(null);
      setError('');
    },
    onError: (e: unknown) => setError(typeof e === 'string' ? e : (e as Error).message),
  });

  const switchMutation = useMutation({
    mutationFn: cmd.switchProfile,
  });

  const deleteMutation = useMutation({
    mutationFn: cmd.deleteProfile,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profiles'] }),
    onError: (e: unknown) => setError(typeof e === 'string' ? e : (e as Error).message),
  });

  const startEdit = (profile: Profile) => {
    setEditingId(profile.id);
    setEditName(profile.name);
    setError('');
  };

  const f = 'text-sm border border-slate-300 rounded px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500';

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">
        Cada perfil tiene su propia base de datos independiente. Cambiar de perfil reinicia la app.
      </p>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
          {error}
        </div>
      )}

      {/* Lista de perfiles */}
      <div className="space-y-2">
        {profiles.map((profile) => {
          const isActive = profile.id === activeId;
          return (
            <div
              key={profile.id}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg border bg-white ${
                isActive ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200'
              }`}
            >
              {/* Indicador activo */}
              <div className={`w-2 h-2 rounded-full shrink-0 ${isActive ? 'bg-indigo-500' : 'bg-slate-200'}`} />

              {/* Nombre — editable inline */}
              {editingId === profile.id ? (
                <input
                  autoFocus
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') renameMutation.mutate({ id: profile.id, name: editName });
                    if (e.key === 'Escape') setEditingId(null);
                  }}
                  className={`flex-1 ${f}`}
                />
              ) : (
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium truncate ${isActive ? 'text-indigo-700' : 'text-slate-800'}`}>
                    {profile.name}
                    {isActive && <span className="ml-2 text-xs font-normal text-indigo-500">activo</span>}
                  </p>
                </div>
              )}

              {/* Acciones */}
              <div className="flex items-center gap-1 shrink-0">
                {editingId === profile.id ? (
                  <>
                    <button
                      onClick={() => renameMutation.mutate({ id: profile.id, name: editName })}
                      disabled={renameMutation.isPending}
                      className="p-1.5 text-indigo-600 hover:text-indigo-800 disabled:opacity-40"
                      title="Guardar"
                    >
                      <Check size={14} />
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="p-1.5 text-slate-400 hover:text-slate-600"
                      title="Cancelar"
                    >
                      <X size={14} />
                    </button>
                  </>
                ) : (
                  <>
                    {!isActive && (
                      <button
                        onClick={() => { setError(''); switchMutation.mutate(profile.id); }}
                        disabled={switchMutation.isPending}
                        className="p-1.5 text-slate-300 hover:text-indigo-500 transition-colors disabled:opacity-40"
                        title="Cambiar a este perfil"
                      >
                        <LogIn size={14} />
                      </button>
                    )}
                    <button
                      onClick={() => startEdit(profile)}
                      className="p-1.5 text-slate-300 hover:text-indigo-500 transition-colors"
                      title="Renombrar"
                    >
                      <Pencil size={13} />
                    </button>
                    {!isActive && (
                      <button
                        onClick={() => {
                          setError('');
                          if (window.confirm(`¿Eliminar el perfil "${profile.name}"?\n\nSus datos quedarán en el dispositivo pero no serán accesibles desde la app.`)) {
                            deleteMutation.mutate(profile.id);
                          }
                        }}
                        className="p-1.5 text-slate-300 hover:text-red-500 transition-colors"
                        title="Eliminar perfil"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Formulario nuevo perfil */}
      {showForm ? (
        <div className="flex gap-2">
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newName.trim()) createMutation.mutate();
              if (e.key === 'Escape') { setShowForm(false); setNewName(''); }
            }}
            placeholder="Nombre del perfil"
            className={`flex-1 ${f}`}
          />
          <button
            onClick={() => createMutation.mutate()}
            disabled={!newName.trim() || createMutation.isPending}
            className="text-sm bg-indigo-600 text-white rounded px-4 py-1.5 hover:bg-indigo-700 disabled:opacity-50"
          >
            Crear
          </button>
          <button
            onClick={() => { setShowForm(false); setNewName(''); }}
            className="text-sm text-slate-500 hover:text-slate-700 px-3 py-1.5"
          >
            Cancelar
          </button>
        </div>
      ) : (
        <button
          onClick={() => { setShowForm(true); setError(''); }}
          className="flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-800"
        >
          <Plus size={16} /> Nuevo perfil
        </button>
      )}
    </div>
  );
}
