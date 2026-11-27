# Verificación independiente

Una segunda implementación del reto, en **Python** y solo con la biblioteca estándar, escrita a partir de
`docs/INDICACIONES_RETO_RANKING_CREDITO.md` **sin mirar el motor JavaScript** de la aplicación.

**Por qué existe:** el criterio de exactitud vale 25 puntos y no da crédito parcial. Si dos implementaciones
hechas por separado, en lenguajes distintos, producen exactamente los mismos CSV (al centavo y a la cuarta
cifra decimal), la probabilidad de que las dos tengan el mismo error es muy baja. Es nuestra evidencia de
exactitud y de pruebas.

Cómo calcula:
- lee los códigos como texto, así conservan los ceros a la izquierda (`07`, `001`);
- suma en centavos enteros, nunca en punto flotante;
- redondea `Ponderacion_Pct` a 4 decimales con redondeo aritmético hecho con enteros;
- aplica la cascada E1 → E2 → E3 → E4 por período, tomado del campo `Fecha`;
- aplica la regla SB21 de CONSUMO;
- comprueba las reconciliaciones R1, R2 y R3.

## Cómo se corre

```bash
# 1. Referencia (Python 3.10 o más reciente, sin instalar nada)
python3 -I verificacion/referencia.py datos/reto salida-referencia/

# 2. Exportaciones de la app (motor JavaScript)
npm run exportar            # escribe en exportaciones/

# 3. Comparar celda por celda, sin tolerancia
python3 -I verificacion/comparar.py salida-referencia exportaciones
```

`comparar.py` empareja las filas por su llave (por ejemplo, `Fecha + Ranking + Posicion`) y compara cada celda:
- montos y conteos como `Decimal` exacto;
- códigos y textos tal cual.

No compara las columnas descriptivas: `Motivo` y `Significativo`, que dependen de la redacción y de la regla configurable de la app. Para incluirlas, usa `--estricto`. Termina con `IDÉNTICOS` o con la lista de diferencias, y en ese caso sale con código 1.

## Resultados de la referencia

| Período | Filas leídas | E1 | E2 | E3 | E4 | Universo válido | Saldo del universo |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 20260731 | 25000 | 20 | 886 | 48 | 42 | 24004 | 4342391663.85 |
| 20260831 | 27500 | 25 | 967 | 52 | 46 | 26410 | 4733510382.80 |
| 20260930 | 30000 | 30 | 1058 | 58 | 52 | 28802 | 5152103850.27 |

En los tres períodos cuadran R1, R2, R3 y la identidad `leídas = E1 + E2 + E3 + E4 + universo`. Los préstamos son únicos en el universo y no hay alertas de integridad referencial.

Operaciones de Crédito personal con facilidad 07 reclasificadas a Tarjeta: 295, 325 y 362.
