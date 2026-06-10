
-- 1. Schema additions
ALTER TABLE public.songs
  ADD COLUMN IF NOT EXISTS is_catalog_default boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS songs_catalog_difficulty_idx
  ON public.songs (is_catalog_default, difficulty);

-- 2. Seed curated CEFR catalog. ON CONFLICT keeps the seed idempotent on youtube_id.
CREATE UNIQUE INDEX IF NOT EXISTS songs_youtube_id_unique ON public.songs (youtube_id);

INSERT INTO public.songs (title, artist, genre, youtube_id, album_art_url, difficulty, is_catalog_default) VALUES
-- ===== A1 (beginner, slow, repetitive, simple vocab) =====
('Despacito',                       'Luis Fonsi ft. Daddy Yankee', 'reggaeton',    'kJQP7kiw5Fk', 'https://i.ytimg.com/vi/kJQP7kiw5Fk/hqdefault.jpg', 'A1', true),
('Waka Waka (Esto es África)',      'Shakira',                     'pop latino',   'pRpeEdMmmQ0', 'https://i.ytimg.com/vi/pRpeEdMmmQ0/hqdefault.jpg', 'A1', true),
('Bailando',                        'Enrique Iglesias',            'pop latino',   'NUsoVlDFqZg', 'https://i.ytimg.com/vi/NUsoVlDFqZg/hqdefault.jpg', 'A1', true),
('Échame La Culpa',                 'Luis Fonsi & Demi Lovato',    'pop latino',   'TyHvyGVs42U', 'https://i.ytimg.com/vi/TyHvyGVs42U/hqdefault.jpg', 'A1', true),
('Mi Gente',                        'J Balvin & Willy William',    'reggaeton',    'wnJ6LuUFpMo', 'https://i.ytimg.com/vi/wnJ6LuUFpMo/hqdefault.jpg', 'A1', true),
('Danza Kuduro',                    'Don Omar ft. Lucenzo',        'reggaeton',    '7zp1TbLFPp8', 'https://i.ytimg.com/vi/7zp1TbLFPp8/hqdefault.jpg', 'A1', true),
('Súbeme la Radio',                 'Enrique Iglesias',            'pop latino',   'p_di4Zn4wz4', 'https://i.ytimg.com/vi/p_di4Zn4wz4/hqdefault.jpg', 'A1', true),
('Sofia',                           'Álvaro Soler',                'pop latino',   'qaZ0oAh4evU', 'https://i.ytimg.com/vi/qaZ0oAh4evU/hqdefault.jpg', 'A1', true),
('Vivir Mi Vida',                   'Marc Anthony',                'salsa',        'YXnjy5YlDwk', 'https://i.ytimg.com/vi/YXnjy5YlDwk/hqdefault.jpg', 'A1', true),
('La Bicicleta',                    'Carlos Vives & Shakira',      'pop latino',   '-UV0QGLmYys', 'https://i.ytimg.com/vi/-UV0QGLmYys/hqdefault.jpg', 'A1', true),
('Felices los 4',                   'Maluma',                      'reggaeton',    'qFLhGq0M5g8', 'https://i.ytimg.com/vi/qFLhGq0M5g8/hqdefault.jpg', 'A1', true),
('El Perdón',                       'Nicky Jam & Enrique Iglesias','reggaeton',    'HUHC9tYz8ik', 'https://i.ytimg.com/vi/HUHC9tYz8ik/hqdefault.jpg', 'A1', true),
('Loca',                            'Shakira ft. El Cata',         'pop latino',   'm3HfvznRWZQ', 'https://i.ytimg.com/vi/m3HfvznRWZQ/hqdefault.jpg', 'A1', true),
('Corazón Sin Cara',                'Prince Royce',                'bachata',      'WHWmCp0RXjQ', 'https://i.ytimg.com/vi/WHWmCp0RXjQ/hqdefault.jpg', 'A1', true),
('Darte un Beso',                   'Prince Royce',                'bachata',      'XbnshlIqZHc', 'https://i.ytimg.com/vi/XbnshlIqZHc/hqdefault.jpg', 'A1', true),
('Reggaeton Lento (Bailemos)',      'CNCO',                        'reggaeton',    'h7CO5BvkjCM', 'https://i.ytimg.com/vi/h7CO5BvkjCM/hqdefault.jpg', 'A1', true),
('Calma (Remix)',                   'Pedro Capó & Farruko',        'pop latino',   '1_zgKRBrT0Y', 'https://i.ytimg.com/vi/1_zgKRBrT0Y/hqdefault.jpg', 'A1', true),
('Bésame Mucho',                    'Cesária Évora / Trio Los Panchos','pop latino','rJgWVjnXRPI', 'https://i.ytimg.com/vi/rJgWVjnXRPI/hqdefault.jpg', 'A1', true),

-- ===== A2 (elementary, clear pronunciation, common phrases) =====
('Hips Don''t Lie',                 'Shakira ft. Wyclef Jean',     'pop latino',   'DUT5rEU6pqM', 'https://i.ytimg.com/vi/DUT5rEU6pqM/hqdefault.jpg', 'A2', true),
('Chantaje',                        'Shakira ft. Maluma',          'reggaeton',    '6Mgqbai3fKo', 'https://i.ytimg.com/vi/6Mgqbai3fKo/hqdefault.jpg', 'A2', true),
('Tusa',                            'Karol G & Nicki Minaj',       'reggaeton',    'tbneQDc2H3I', 'https://i.ytimg.com/vi/tbneQDc2H3I/hqdefault.jpg', 'A2', true),
('Con Calma',                       'Daddy Yankee & Snow',         'reggaeton',    'DiItGE3eAyQ', 'https://i.ytimg.com/vi/DiItGE3eAyQ/hqdefault.jpg', 'A2', true),
('Bichota',                         'Karol G',                     'reggaeton',    'c4Ihn6JOQ3I', 'https://i.ytimg.com/vi/c4Ihn6JOQ3I/hqdefault.jpg', 'A2', true),
('China',                           'Anuel AA, Daddy Yankee, KAROL G','reggaeton', 'pSI3oNFHpHI', 'https://i.ytimg.com/vi/pSI3oNFHpHI/hqdefault.jpg', 'A2', true),
('Taki Taki',                       'DJ Snake ft. Selena Gomez, Ozuna, Cardi B','reggaeton','ixkoVwKQaJg','https://i.ytimg.com/vi/ixkoVwKQaJg/hqdefault.jpg','A2', true),
('X (Equis)',                       'Nicky Jam x J Balvin',        'reggaeton',    'rOnGwp4ZQ7Y', 'https://i.ytimg.com/vi/rOnGwp4ZQ7Y/hqdefault.jpg', 'A2', true),
('Felices los 4 (Salsa Version)',   'Maluma & Marc Anthony',       'salsa',        'iVO4DGN8Bcc', 'https://i.ytimg.com/vi/iVO4DGN8Bcc/hqdefault.jpg', 'A2', true),
('Vente Pa Ca',                     'Ricky Martin ft. Maluma',     'pop latino',   'iukS5Ksrcr4', 'https://i.ytimg.com/vi/iukS5Ksrcr4/hqdefault.jpg', 'A2', true),
('Eres Mía',                        'Romeo Santos',                'bachata',      'O8XCkk_pH9k', 'https://i.ytimg.com/vi/O8XCkk_pH9k/hqdefault.jpg', 'A2', true),
('Promise',                         'Romeo Santos ft. Usher',      'bachata',      'L-Pyay8YseA', 'https://i.ytimg.com/vi/L-Pyay8YseA/hqdefault.jpg', 'A2', true),
('Sin Pijama',                      'Becky G & Natti Natasha',     'reggaeton',    'iGk5fR-t5AU', 'https://i.ytimg.com/vi/iGk5fR-t5AU/hqdefault.jpg', 'A2', true),
('Felices los 4 (Pop)',             'Maluma',                      'pop latino',   '4dyq7Tk5e2Y', 'https://i.ytimg.com/vi/4dyq7Tk5e2Y/hqdefault.jpg', 'A2', true),
('Adventure of a Lifetime (Spanish radio mix)','Coldplay',          'pop latino',   'QtXby3twMmI', 'https://i.ytimg.com/vi/QtXby3twMmI/hqdefault.jpg', 'A2', true),
('Suerte (Whenever, Wherever)',     'Shakira',                     'pop latino',   'JFm7YDVlqnI', 'https://i.ytimg.com/vi/JFm7YDVlqnI/hqdefault.jpg', 'A2', true),
('Felicidad',                       'Bonny Lovy',                  'pop latino',   'KkBC5RxhuJk', 'https://i.ytimg.com/vi/KkBC5RxhuJk/hqdefault.jpg', 'A2', true),
('No Me Doy por Vencido',           'Luis Fonsi',                  'pop latino',   'qoUtKWLT4OY', 'https://i.ytimg.com/vi/qoUtKWLT4OY/hqdefault.jpg', 'A2', true),

-- ===== B1 (intermediate, idioms, faster delivery) =====
('La Tortura',                      'Shakira ft. Alejandro Sanz',  'pop latino',   'Dsp_8Lm1eSk', 'https://i.ytimg.com/vi/Dsp_8Lm1eSk/hqdefault.jpg', 'B1', true),
('La Camisa Negra',                 'Juanes',                      'rock latino',  'rdwz7QiG0lk', 'https://i.ytimg.com/vi/rdwz7QiG0lk/hqdefault.jpg', 'B1', true),
('Me Enamoré',                      'Shakira',                     'pop latino',   'sP4NMoJcFL4', 'https://i.ytimg.com/vi/sP4NMoJcFL4/hqdefault.jpg', 'B1', true),
('Propuesta Indecente',             'Romeo Santos',                'bachata',      'QFs3PIZb3js', 'https://i.ytimg.com/vi/QFs3PIZb3js/hqdefault.jpg', 'B1', true),
('Obsesión',                        'Aventura',                    'bachata',      'jZHd-G2Yc-c', 'https://i.ytimg.com/vi/jZHd-G2Yc-c/hqdefault.jpg', 'B1', true),
('Volví',                           'Aventura & Bad Bunny',        'bachata',      'mNFCM_YIqTM', 'https://i.ytimg.com/vi/mNFCM_YIqTM/hqdefault.jpg', 'B1', true),
('Tití Me Preguntó',                'Bad Bunny',                   'reggaeton',    'Cr8K88UcO0s', 'https://i.ytimg.com/vi/Cr8K88UcO0s/hqdefault.jpg', 'B1', true),
('Me Porto Bonito',                 'Bad Bunny & Chencho Corleone','reggaeton',    'saGYMhApaH8', 'https://i.ytimg.com/vi/saGYMhApaH8/hqdefault.jpg', 'B1', true),
('Provenza',                        'Karol G',                     'reggaeton',    'tNvh2w8lTes', 'https://i.ytimg.com/vi/tNvh2w8lTes/hqdefault.jpg', 'B1', true),
('Mientes',                         'Camila',                      'pop latino',   'KxA6lXyc1Hk', 'https://i.ytimg.com/vi/KxA6lXyc1Hk/hqdefault.jpg', 'B1', true),
('A Dios Le Pido',                  'Juanes',                      'rock latino',  '01QdqR-vMTc', 'https://i.ytimg.com/vi/01QdqR-vMTc/hqdefault.jpg', 'B1', true),
('Me Gustas Tú',                    'Manu Chao',                   'rock latino',  'Va3sCNvKr8w', 'https://i.ytimg.com/vi/Va3sCNvKr8w/hqdefault.jpg', 'B1', true),
('Burbujas de Amor',                'Juan Luis Guerra',            'bachata',      'kjPRmpgIVHQ', 'https://i.ytimg.com/vi/kjPRmpgIVHQ/hqdefault.jpg', 'B1', true),
('Bachata Rosa',                    'Juan Luis Guerra',            'bachata',      'rkZ-DwiNqWk', 'https://i.ytimg.com/vi/rkZ-DwiNqWk/hqdefault.jpg', 'B1', true),
('Suavemente',                      'Elvis Crespo',                'merengue',     'XPF4nGboHFw', 'https://i.ytimg.com/vi/XPF4nGboHFw/hqdefault.jpg', 'B1', true),
('Bailamos',                        'Enrique Iglesias',            'pop latino',   'NVqXFK8KuOM', 'https://i.ytimg.com/vi/NVqXFK8KuOM/hqdefault.jpg', 'B1', true),
('Solo Tú',                         'Cali y El Dandee',            'pop latino',   'k9-2L5RShzs', 'https://i.ytimg.com/vi/k9-2L5RShzs/hqdefault.jpg', 'B1', true),
('Vente Conmigo',                   'Daddy Yankee & Marc Anthony', 'salsa',        'WhEHCfP0hL0', 'https://i.ytimg.com/vi/WhEHCfP0hL0/hqdefault.jpg', 'B1', true),

-- ===== B2 (upper-intermediate, dense slang, fast lyrical flow) =====
('Antes de que Cuente Diez',        'Fito Páez',                   'rock latino',  'h_8H_3OWa10', 'https://i.ytimg.com/vi/h_8H_3OWa10/hqdefault.jpg', 'B2', true),
('Vida Es Un Carnaval',             'Celia Cruz',                  'salsa',        'rzpHwlNTzMM', 'https://i.ytimg.com/vi/rzpHwlNTzMM/hqdefault.jpg', 'B2', true),
('Pedro Navaja',                    'Rubén Blades',                'salsa',        'rNh6Jzn8K5o', 'https://i.ytimg.com/vi/rNh6Jzn8K5o/hqdefault.jpg', 'B2', true),
('Lamento Boliviano',               'Enanitos Verdes',             'rock latino',  '7tkX5OF44Sk', 'https://i.ytimg.com/vi/7tkX5OF44Sk/hqdefault.jpg', 'B2', true),
('Oye Cómo Va',                     'Santana',                     'rock latino',  'YqsR9KIPC9c', 'https://i.ytimg.com/vi/YqsR9KIPC9c/hqdefault.jpg', 'B2', true),
('Clavado en un Bar',               'Maná',                        'rock latino',  'd6sUyR1Bz_8', 'https://i.ytimg.com/vi/d6sUyR1Bz_8/hqdefault.jpg', 'B2', true),
('Rayando el Sol',                  'Maná',                        'rock latino',  'qY1n6yvqUlk', 'https://i.ytimg.com/vi/qY1n6yvqUlk/hqdefault.jpg', 'B2', true),
('Andar Conmigo',                   'Julieta Venegas',             'pop latino',   'aQUnnUgsCwI', 'https://i.ytimg.com/vi/aQUnnUgsCwI/hqdefault.jpg', 'B2', true),
('Limón y Sal',                     'Julieta Venegas',             'pop latino',   '2zpu1L8eO_Y', 'https://i.ytimg.com/vi/2zpu1L8eO_Y/hqdefault.jpg', 'B2', true),
('Eres',                            'Café Tacvba',                 'rock latino',  '3kAOcEvbWAk', 'https://i.ytimg.com/vi/3kAOcEvbWAk/hqdefault.jpg', 'B2', true),
('Yo Perreo Sola',                  'Bad Bunny',                   'reggaeton',    'GtSRKwDCaZM', 'https://i.ytimg.com/vi/GtSRKwDCaZM/hqdefault.jpg', 'B2', true),
('Safaera',                         'Bad Bunny, Jowell & Randy, Ñengo Flow','reggaeton','tEx4tDvWrSk','https://i.ytimg.com/vi/tEx4tDvWrSk/hqdefault.jpg','B2', true),
('Dákiti',                          'Bad Bunny & Jhay Cortez',     'reggaeton',    'rGlJVtcbVKM', 'https://i.ytimg.com/vi/rGlJVtcbVKM/hqdefault.jpg', 'B2', true),
('La Canción',                      'J Balvin & Bad Bunny',        'reggaeton',    'NeQM1c-XCDc', 'https://i.ytimg.com/vi/NeQM1c-XCDc/hqdefault.jpg', 'B2', true),
('Soy Yo',                          'Bomba Estéreo',               'pop latino',   'mq9LlPGFP_8', 'https://i.ytimg.com/vi/mq9LlPGFP_8/hqdefault.jpg', 'B2', true),
('Latinoamérica',                   'Calle 13',                    'rock latino',  'DkFJE8ZdeG8', 'https://i.ytimg.com/vi/DkFJE8ZdeG8/hqdefault.jpg', 'B2', true),
('Atrévete-te-te',                  'Calle 13',                    'rock latino',  '2GGyqXNQHQ8', 'https://i.ytimg.com/vi/2GGyqXNQHQ8/hqdefault.jpg', 'B2', true),
('Robarte un Beso',                 'Carlos Vives & Sebastián Yatra','pop latino', 'mPF8ZQK4HoY', 'https://i.ytimg.com/vi/mPF8ZQK4HoY/hqdefault.jpg', 'B2', true)
ON CONFLICT (youtube_id) DO UPDATE
  SET is_catalog_default = EXCLUDED.is_catalog_default,
      difficulty = EXCLUDED.difficulty,
      title = EXCLUDED.title,
      artist = EXCLUDED.artist,
      genre = EXCLUDED.genre,
      album_art_url = COALESCE(public.songs.album_art_url, EXCLUDED.album_art_url);
