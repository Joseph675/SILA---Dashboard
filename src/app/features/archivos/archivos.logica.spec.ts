import { ACCEPT_SUBIDA, TAMANO_MAXIMO_BYTES, describirFalloSubida, extensionDe, etiquetaTipoArchivo, formatoTamano, insigniasDe, rutaDeQuery, rutaMasProfunda, tituloArchivo, validarArchivoParaSubir, validarArchivoSila, validarClaveEscrita } from './archivos.logica';

const archivo = (name: string, size: number) => ({ name, size });

describe('validar archivo para subir', () => {
  it.each(['a.pdf', 'FOTO.JPG', 'x.jpeg', 'logo.PNG', 'con.varios.puntos.pdf'])('admite %s', (n) => expect(validarArchivoParaSubir(archivo(n, 1000))).toBeNull());

  it.each(['virus.exe', 'macro.docx', 'sin-extension', 'foto.gif', 'doc.pdf.exe', 'x.sila'])('rechaza %s por su extensión', (n) => {
    expect(validarArchivoParaSubir(archivo(n, 1000))).toBe('Solo se admiten archivos PDF, JPG o PNG.');
  });

  it('10 MB justos pasan; un byte más no', () => {
    expect(validarArchivoParaSubir(archivo('a.pdf', TAMANO_MAXIMO_BYTES))).toBeNull();
    expect(validarArchivoParaSubir(archivo('a.pdf', TAMANO_MAXIMO_BYTES + 1))).toBe('El archivo supera 10 MB.');
  });

  it('un archivo vacío no sube', () => {
    expect(validarArchivoParaSubir(archivo('a.pdf', 0))).toBe('El archivo está vacío.');
  });

  it('el atributo accept del input coincide con lo permitido', () => {
    expect(ACCEPT_SUBIDA).toBe('.pdf,.jpg,.jpeg,.png');
  });

  it('extensionDe', () => {
    expect(extensionDe('a.b.PDF')).toBe('pdf');
    expect(extensionDe('sin')).toBe('');
  });
});

describe('validar un .sila', () => {
  it('solo .sila y hasta 11 MB', () => {
    expect(validarArchivoSila(archivo('a1b2.sila', 5000))).toBeNull();
    expect(validarArchivoSila(archivo('a.pdf', 5000))).toContain('.sila');
    expect(validarArchivoSila(archivo('a.sila', 11 * 1024 * 1024))).toBeNull();
    expect(validarArchivoSila(archivo('a.sila', 11 * 1024 * 1024 + 1))).toBe('El archivo supera 11 MB.');
    expect(validarArchivoSila(archivo('a.sila', 0))).toBe('El archivo está vacío.');
  });
});

describe('mensajes de una subida que falla', () => {
  it('422 (20018): el mensaje del servidor tal cual, sin reintento', () => {
    expect(describirFalloSubida({ code: 20018, message: 'El PDF tiene JavaScript y no se admite.' })).toEqual({ mensaje: 'El PDF tiene JavaScript y no se admite.', reintentable: false });
  });

  it('503 (20019): el antivirus no está, el archivo NO se guardó y se puede reintentar', () => {
    expect(describirFalloSubida({ code: 20019, message: 'ClamAV no responde' })).toEqual({
      mensaje: 'El antivirus no está disponible; el archivo no se guardó. Intente en unos minutos.',
      reintentable: true,
    });
  });

  it('413: lo que dice el interceptor (supera 10 MB), sin reintento', () => {
    const r = describirFalloSubida({ code: 0, message: 'El archivo supera el tamaño máximo permitido (10 MB).' });
    expect(r.mensaje).toContain('10 MB');
    expect(r.reintentable).toBe(false);
  });

  it('409 (carpeta archivada): el mensaje del servidor', () => {
    expect(describirFalloSubida({ code: 20010, message: 'La carpeta está archivada.' }).mensaje).toBe('La carpeta está archivada.');
  });

  it('algo que no es un ApiError: un mensaje genérico', () => {
    expect(describirFalloSubida(new Error('boom')).mensaje).toBe('No se pudo subir el archivo. Intenta de nuevo.');
  });
});

describe('formatoTamano', () => {
  it.each([
    [0, '0 B'],
    [900, '900 B'],
    [1024, '1 KB'],
    [1536, '1,5 KB'],
    [10 * 1024 * 1024, '10 MB'],
    [3.4 * 1024 * 1024, '3,4 MB'],
    [-1, '—'],
  ])('%s → %s', (bytes, texto) => expect(formatoTamano(bytes)).toBe(texto));
});

describe('insignias y títulos', () => {
  const base = { version: 'ORIGINAL' as const, estado_comprobante: 'VIGENTE' as const, archivado: false, estado_drive: 'SUBIDO' as const };

  it('un archivo sano no lleva insignias', () => {
    expect(insigniasDe(base)).toEqual([]);
  });

  it('ANULADO en rojo, Archivado en gris y «Sin respaldo en Drive» si la copia no está SUBIDA', () => {
    expect(insigniasDe({ ...base, version: 'ANULADO' })).toEqual([{ texto: 'ANULADO', tono: 'peligro' }]);
    expect(insigniasDe({ ...base, archivado: true })).toEqual([{ texto: 'Archivado', tono: 'neutro' }]);
    expect(insigniasDe({ ...base, estado_drive: 'PENDIENTE' })).toEqual([{ texto: 'Sin respaldo en Drive', tono: 'alerta' }]);
    expect(insigniasDe({ ...base, estado_drive: 'ERROR' })).toEqual([{ texto: 'Sin respaldo en Drive', tono: 'alerta' }]);
    expect(insigniasDe({ ...base, version: 'ANULADO', archivado: true, estado_drive: 'ERROR' }).map((i) => i.texto)).toEqual(['ANULADO', 'Archivado', 'Sin respaldo en Drive']);
  });

  it('un comprobante muestra su número (sin guion bajo) y el de anulación lo dice; un archivo subido, su nombre', () => {
    expect(tituloArchivo({ numero: 'COMPRA_INSUMO #25', nombre_archivo: 'x.pdf', version: 'ORIGINAL' })).toBe('COMPRA INSUMO #25');
    expect(tituloArchivo({ numero: 'VENTA #7', nombre_archivo: 'x.pdf', version: 'ANULADO' })).toBe('VENTA #7 · anulación');
    expect(tituloArchivo({ numero: null, nombre_archivo: 'Contrato 2026.pdf', version: 'ORIGINAL' })).toBe('Contrato 2026.pdf');
  });

  it('etiquetas de tipo', () => {
    expect(etiquetaTipoArchivo('ARCHIVO')).toBe('Archivo subido');
    expect(etiquetaTipoArchivo('PAGO_LECHERO')).toBe('Pago a lecheros');
  });
});

describe('ruta del explorador', () => {
  it('quita vacíos y espacios; baja un nivel agregando la clave', () => {
    expect(rutaDeQuery(['VENTA', ' ', '2026', ''])).toEqual(['VENTA', '2026']);
    expect(rutaMasProfunda([{ clave: 'VENTA', nombre: 'Ventas', cantidad: 3 }], '2026')).toEqual(['VENTA', '2026']);
    expect(rutaMasProfunda([], '7')).toEqual(['7']);
  });
});

describe('clave escrita', () => {
  it('respeta el largo que dice el servidor', () => {
    expect(validarClaveEscrita('abc', 4, 64)).toBe('La clave debe tener al menos 4 caracteres.');
    expect(validarClaveEscrita('abcd', 4, 64)).toBeNull();
    expect(validarClaveEscrita('x'.repeat(64), 4, 64)).toBeNull();
    expect(validarClaveEscrita('x'.repeat(65), 4, 64)).toBe('La clave no puede pasar de 64 caracteres.');
  });
});
