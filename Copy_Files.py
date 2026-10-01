import os
import sys
import glob
from pathlib import Path
from datetime import datetime

# =============================================================================
# НАСТРАИВАЕМЫЕ ПАРАМЕТРЫ
# =============================================================================

# Основные настройки
ROOT_DIR = None  # Если None, используется директория скрипта или переданная аргументом
OUTPUT_FILENAME = 'Project_Files.txt'
MAX_FILE_SIZE = 1048576  # Максимальный размер файла в байтах (1 МБ)
MAX_DEPTH = None  # Максимальная глубина вложенности (None - без ограничений)

# Расширения файлов для обработки
ALLOWED_EXTENSIONS = [
    '.txt', '.bat', '.cmd', '.ps1', '.js', '.html', '.css', 
    '.py', '.java', '.c', '.cpp', '.h', '.cs', '.php', 
    '.xml', '.json', '.config', '.ini', '.md', '.sql', 
    '.yml', '.yaml', '.conf', '.sh', '.bash', '.ts',
    '.vue', '.jsx', '.tsx', '.scss', '.sass', '.less'
]

# Специальные имена файлов (обрабатываются независимо от расширения)
SPECIAL_FILENAMES = [
    'Dockerfile', 'docker-compose.yml', 'nginx.conf', 'Makefile',
    '.env', '.env.example', 'package.json', 'composer.json',
    'requirements.txt', 'pyproject.toml', 'CMakeLists.txt', 'ci-cd.yml'
]

# Директории для исключения (не обрабатываются рекурсивно)
EXCLUDE_DIRS = [
    '.git', 'node_modules', 'bin', 'obj', 'packages', 
    '.vs', '.idea', '__pycache__', '.pytest_cache',
    'dist', 'build', 'target', 'out', 'coverage',
    'logs', 'temp', 'tmp', 'vendor', '.nuget'
]

# Файлы для исключения (полные имена или шаблоны)
EXCLUDE_FILES = [
    'thumbs.db', '.DS_Store', '*.log', '*.tmp',
    '*.min.js', '*.min.css', 'package-lock.json',
    'yarn.lock', '*.pyc', '*.pyo', '*.pyd', 'Project_Files.txt', 
    'Copy_Files_POSSIBLE_DANGER_RUN_ONLY_HERE.py', 'start_copy.bat'
]

# Настройки кодировок для чтения файлов (в порядке приоритета)
FILE_ENCODINGS = ['utf-8', 'cp1251', 'latin-1', 'iso-8859-1', 'cp866']

# Настройки вывода
VERBOSE = True  # Вывод подробной информации о процессе
SHOW_SKIPPED = True  # Показывать пропущенные файлы

# =============================================================================
# ФУНКЦИИ
# =============================================================================

def should_skip_path(file_path, exclude_dirs, exclude_files, root_dir):
    """Проверяет, нужно ли пропустить файл или директорию"""
    path = Path(file_path)
    
    # Проверка директорий для исключения - точное совпадение частей пути
    path_parts = path.parts
    for exclude_dir in exclude_dirs:
        # Проверяем точное совпадение каждой части пути
        if any(part == exclude_dir for part in path_parts):
            return True
    
    # Проверка файлов для исключения
    for pattern in exclude_files:
        if pattern.startswith('*'):
            # Шаблон с wildcard
            if path.name.endswith(pattern[1:]):
                return True
        elif path.name == pattern:
            # Точное совпадение
            return True
    
    return False

def matches_criteria(file_path, allowed_extensions, special_filenames):
    """Проверяет, соответствует ли файл критериям обработки"""
    path = Path(file_path)
    
    # Проверка специальных имен файлов
    if path.name in special_filenames:
        return True
    
    # Проверка расширений
    if path.suffix.lower() in allowed_extensions:
        return True
    
    return False

def read_file_content(file_path, encodings):
    """Читает содержимое файла с обработкой различных кодировок"""
    for encoding in encodings:
        try:
            with open(file_path, 'r', encoding=encoding) as src_file:
                return src_file.read()
        except UnicodeDecodeError:
            continue
        except Exception as e:
            return f'[Ошибка чтения файла: {str(e)}]'
    return '[Ошибка чтения файла - не удалось декодировать файл]'

def process_single_file(file_path, result_file, max_size, root_dir):
    """Обрабатывает один файл и записывает результат"""
    try:
        file_size = os.path.getsize(file_path)
        mod_time = datetime.fromtimestamp(os.path.getmtime(file_path))
        
        # Относительный путь для красивого вывода
        try:
            relative_path = os.path.relpath(file_path, root_dir)
        except ValueError:
            relative_path = file_path
        
        if file_size >= max_size:
            if SHOW_SKIPPED:
                print(f'Пропуск большого файла: {relative_path} ({file_size} байт)')
            result_file.write(f'[Файл: {relative_path} - ПРОПУЩЕН (слишком большой: {file_size} байт)]\n')
            return False, file_size

        if VERBOSE:
            print(f'Обработка: {relative_path}')
        
        result_file.write(f'[Файл: {relative_path}]\n')
        result_file.write(f'[Размер: {file_size} байт]\n')
        result_file.write(f'[Дата изменения: {mod_time}]\n\n')
        
        content = read_file_content(file_path, FILE_ENCODINGS)
        result_file.write(content)
        result_file.write('\n\n-----\n\n')
        return True, file_size
        
    except Exception as e:
        print(f'Ошибка при обработке файла {file_path}: {e}')
        return False, 0

def collect_files(root_dir, max_depth=None):
    """Собирает все файлы для обработки с учетом глубины вложенности"""
    all_files = []
    
    # Функция для проверки глубины
    def is_within_depth(file_path, max_depth):
        if max_depth is None:
            return True
        try:
            relative_path = Path(file_path).relative_to(root_dir)
            path_depth = len(relative_path.parts) - 1  # -1 потому что файл считается за уровень
            return path_depth <= max_depth
        except ValueError:
            return True
    
    # Сбор файлов по расширениям
    for extension in ALLOWED_EXTENSIONS:
        pattern = os.path.join(root_dir, '**', f'*{extension}')
        for file_path in glob.glob(pattern, recursive=True):
            if (os.path.isfile(file_path) and 
                not should_skip_path(file_path, EXCLUDE_DIRS, EXCLUDE_FILES, root_dir) and
                is_within_depth(file_path, max_depth) and
                matches_criteria(file_path, ALLOWED_EXTENSIONS, SPECIAL_FILENAMES)):
                all_files.append(file_path)
    
    # Сбор специальных файлов
    for filename in SPECIAL_FILENAMES:
        pattern = os.path.join(root_dir, '**', filename)
        for file_path in glob.glob(pattern, recursive=True):
            if (os.path.isfile(file_path) and 
                not should_skip_path(file_path, EXCLUDE_DIRS, EXCLUDE_FILES, root_dir) and
                is_within_depth(file_path, max_depth) and
                matches_criteria(file_path, ALLOWED_EXTENSIONS, SPECIAL_FILENAMES)):
                all_files.append(file_path)
    
    # Удаление дубликатов
    return list(set(all_files))

def main():
    # Установка корневой директории
    root_dir = ROOT_DIR
    if root_dir is None:
        root_dir = sys.argv[1] if len(sys.argv) > 1 else os.path.dirname(os.path.abspath(__file__))
    
    if not os.path.exists(root_dir):
        print(f'Ошибка: Директория "{root_dir}" не существует!')
        input('Нажмите Enter для выхода...')
        return 1
    
    root_dir = os.path.abspath(root_dir)
    
    print(f'Рабочая директория: {root_dir}')
    if MAX_DEPTH:
        print(f'Максимальная глубина: {MAX_DEPTH}')
    print(f'Максимальный размер файла: {MAX_FILE_SIZE} байт')
    print()
    
    # Удалить существующий файл результатов
    if os.path.exists(OUTPUT_FILENAME):
        os.remove(OUTPUT_FILENAME)
    
    print('Сбор файлов для обработки...')
    files_to_process = collect_files(root_dir, MAX_DEPTH)
    print(f'Найдено файлов для обработки: {len(files_to_process)}')
    
    # Отладочная информация: покажем файлы в .github
    github_files = [f for f in files_to_process if '.github' in f]
    if github_files:
        print(f'Найдено файлов в .github: {len(github_files)}')
        for f in github_files:
            print(f'  - {os.path.relpath(f, root_dir)}')
    print()
    
    if VERBOSE:
        print('Начало обработки файлов...')
        print()
    
    processed_files = 0
    skipped_files = 0

    # Обработка всех файлов
    with open(OUTPUT_FILENAME, 'a', encoding='utf-8') as result_file:
        for file_path in files_to_process:
            success, file_size = process_single_file(
                file_path, result_file, MAX_FILE_SIZE, root_dir
            )
            if success:
                processed_files += 1
            elif file_size > 0:  # Файл был пропущен из-за размера
                skipped_files += 1

    print()
    print(f'Готово! Результат сохранен в {OUTPUT_FILENAME}')
    print(f'Обработано файлов: {processed_files}, пропущено: {skipped_files}')
    print(f'Всего найдено: {len(files_to_process)}')
    print(f'Обработана директория: {root_dir}')
    
    # Пауза в конце
    input('Нажмите Enter для выхода...')
    return 0

if __name__ == '__main__':
    sys.exit(main())