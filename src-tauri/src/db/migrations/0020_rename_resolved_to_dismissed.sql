-- Corrección semántica: "resuelto" implica que el problema financiero fue
-- solucionado, lo que es incorrecto. "descartado" refleja que el usuario
-- solo ocultó la alerta, sin modificar el estado financiero real.

ALTER TABLE notification_state RENAME COLUMN resolved_at TO dismissed_at;
