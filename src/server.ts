import express from "express";
import { Prisma, PrismaClient } from "@prisma/client";
import swaggerUi from 'swagger-ui-express';
import swaggerDocument from  '../swagger.json'
import { equal } from "assert";

const port = 3000;
const app = express();
const prisma = new PrismaClient();

app.use(express.json());

app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.get("/movies", async (_, res)=>{
  try{
    const movies = await prisma.movie.findMany({
    orderBy: {
      title: 'asc'
    },
    include: {
      genres: true,
      language: true,
    }
    });
    //1 - Cálculo da quantidade total de filmes
    const totalMovies = movies.length;

    // Cálculo da média de duração dos filmes
    let totalDuration = 0;
    for(const movie of movies ){
      totalDuration += movie.duration;
    }
    const averageDuration = totalMovies > 0 ? totalDuration / totalMovies : 0;

    res.json({
      totalMovies,
      averageDuration,
      movies
    })
  }catch(error) {
    console.log(error);
    res.status(500).send({message: "Houve um problema ao buscar os filmes."})
  }

});

app.post("/movies", async(req, res) => {

  const {title, genre_id, language_id, oscar_count, release_date, duration} = req.body;

  try{
    const movieWithSameTitle = await prisma.movie.findFirst({
      where: { title: { equals:title, mode: "insensitive"} },
    });

    if(movieWithSameTitle) {
      return res.status(409).send({message: "Já existe um filme cadastrado com este titulo."});
    }

    await prisma.movie.create({
      data: {
        title,
        genre_id,
        language_id,
        oscar_count,
        release_date: new Date(release_date),
        duration,
      }
    });
  
  }catch (error){
    console.log(error);
    return res.status(500).send({message: "Falha ao cadastar um filme"});
  }
  
  res.status(201).send();
})

app.put("/movies/:id", async(req, res) => {
  //pegar o id do registro que vai ser atualizado
  const id = Number(req.params.id)

  try{
    const movie = await prisma.movie.findUnique({
      where: {
        id
      }
    });

    if(!movie){
      return res.status(404).send({message: "Filme não encontrado."})
    }

    const data = {...req.body}
    data.release_date = data.release_date ? new Date(data.release_date) : undefined;
    
    //pegar os dados do filme que sera atualizado e atualizar ele no prisma
    await prisma.movie.update({
      where: {
        id
      },
      data: data,
    })
  }catch(error){
    console.log(error);
    return res.status(500).send({message: "Falha ao atualizar o registro do filme."})
  } 
  //retornar o status correto de que o filme foi atualizado
  res.status(200).send();
})

app.delete("/movies/:id", async(req, res) => {
  const id = Number(req.params.id);

  try{
    const movie = await prisma.movie.findUnique({where: {id}});

    if(!movie) {
      return res.status(404).send({message:"O filme não foi encontrado"})
    }

    await prisma.movie.delete({ where: {id} })
  }catch(error){
    console.log(error);
    return res.status(500).send({message: "Não foi possível remover o filme."})
  }

  res.status(200).send();
})

app.get("/movies/:genreName", async(req, res) => {

  try {
    const genreName = req.params.genreName;
    const moviesFilteredByGenreName = await prisma.movie.findMany({
      include: {
        genres: true,
        language: true,
      },
      where: {
        genres: {
          name: {
            equals: genreName,
            mode: "insensitive"
          },
        }
      }
    });

    res.status(200).send(moviesFilteredByGenreName);
  }catch(error) {
    console.log(error);
    return res.status(500).send({message:"Falha ao filtrar filmes por gênero."})
  }
})

//1) Criando um endpoin para atualizar informações de gênero
app.put("/genres/:id", async(req, res) => {
  //1. Extrai o `id` da rota e o `name` do body da requisição.
  const { id } = req.params;
  const { name } = req.body;
  
  //2. Verifica se o `name` foi fornecido. Se não, retorna um erro 400 ao cliente informando que o nome é obrigatório.
  if(!name) {
    return res.status(400).send({message: "O nome do gênero é obrigatório."})
  }

  try{
    
    //3. Tenta encontrar um gênero com o id fornecido. Se o gênero não for encontrado, retorna um erro 404 ao cliente.
    const genre = await prisma.genre.findUnique({
      where: {id: Number(id)}
    });

    if(!genre) {
      return res.status(404).send({message: "Gênero não encontrado"})
    }

    //4. Verifica se já existe outro gênero com o mesmo nome (ignorando maiúsculas e minúsculas), excluindo o gênero que está sendo atualizado. Se um gênero com o mesmo nome já existir, retorna um erro 409 ao cliente.
    const existingGenre = await prisma.genre.findFirst({
      where: {
        name: {equals: name, mode: "insensitive"},
        id: {not: Number(id)}
      }
    });

    if(existingGenre){
      return res.status(409).send({message: "Este nome de gênero já existe."})
    }

    //5. Se não houver conflito, atualiza o gênero com o novo nome.
    const updateGenre = await prisma.genre.update({
      where: {id:Number(id)},
      data: {name}
    });

    //6. Se a atualização for bem-sucedida, retorna o gênero atualizado ao cliente com um status 200.
    res.status(200).json(updateGenre)
  }catch(error) {
    //7. Se ocorrer um erro durante qualquer parte do processo, retorna um erro 500 ao cliente.
    console.log(error);
    res.status(500).send({message: "Houve um problema ao atualizar o gênero."})
  }

});

app.post("/genres", async (req, res) => {

  //1. Extrai o `name` do body da requisição.
  const { name } = req.body;
  console.log(name);


  //2. Verifica se o `name` foi enviado. Se não, retorna um erro 400 ao cliente informando que o nome é obrigatório.
  if(!name) {
    return res.status(400).send({message:"Por favor, informe o nome do gênero."})
  }

  //3. Tenta encontrar um gênero existente com o mesmo nome (ignorando a diferença entre maiúsculas e minúsculas).
  try{
    const existingGenre = await prisma.genre.findFirst({
      where: {
        name: {equals: name, mode: "insensitive"},
      }
    });

    //4. Se um gênero com o mesmo nome já existir, retorna um erro 409 ao cliente informando que o gênero já existe.
    if(existingGenre){
      return res.status(409).send({message: "Este gênero já existe."})
    }

    //5. Se o gênero não existir, tenta criar um novo gênero no banco de dados.
    const newGenre = await prisma.genre.create({
      data: {
        name
      }
    });

    //6. Se a criação for bem-sucedida, retorna o novo gênero ao cliente com um status 201.
    res.status(201).json(newGenre);

  }catch(error){
    //7. Se ocorrer um erro durante qualquer parte deste processo, retorna um erro 500 ao cliente.
    console.log(error);
    return res.status(500).send({message: "Erro ao cadastar gênero."})
  }
});

app.get("/genres", async (_, res) => {

  //1. Ele busca todos os gêneros na base de dados, ordenando-os pelo campo `name` em ordem ascendente.
  try {
    const genres = await prisma.genre.findMany({
      orderBy: {
        name: 'asc'
      }
    });
    
    //2. Se a busca for bem-sucedida, ele retorna a lista de gêneros ao cliente.
    res.json(genres)
  }catch(error){
    //3. Se ocorrer um erro durante a busca, retorna um erro 500 ao cliente.
    console.log(error);
    return res.status(500).send({message: "Erro ao listar gêneros."})
  }

});

app.delete("/genres/:id", async (req, res) => {
  //1. Extrai o `id` do body da requisição.
  const { id } = req.params;
  //2. Tenta encontrar um gênero com o `id` fornecido.
  try{
    const genre = await prisma.genre.findUnique({
      where: {id: Number(id)}
    });

    //3. Se o gênero não for encontrado, retorna um erro 404 ao cliente.
    if(!genre) {
      return res.status(404).send({message: "Gênero não encontrado."})
    }

     //4. Se o gênero for encontrado, tenta deletar o gênero do banco de dados.
     await prisma.genre.delete({
      where: {id: Number(id)}
     })

      //5. Se a remoção for bem-sucedida, retorna uma mensagem de sucesso ao cliente com um status 200.
      res.status(200).send({message: "Gênero excluído com sucesso !"})
    }catch(error) {
      //6. Se ocorrer um erro durante qualquer parte deste processo, retorna um erro 500 ao cliente.
      console.log(error);
      return res.status(500).send({message: "Houve um problema ao remover o gênero."})
    }
})

app.get("/movies/sort", async(req, res) => {
  //1. Primeiro, extrai o valor de `sort` da string de consulta. Este é o critério que os usuários desejam usar para ordenar os filmes.
  const {sort} = req.query;
  console.log(sort);
  
  //2. Em seguida, define a cláusula `orderBy` com base no valor de `sort`. Se `sort` for "title", a ordenação será por título. Se `sort` for "release_date", a ordenação será por data de lançamento. Se `sort` for um valor não suportado ou não definido, a ordenação será mantida como indefinida, o que significa que o Prisma irá usar a ordenação padrão.
  let orderBy: Prisma.MovieOrderByWithRelationInput | Prisma.MovieOrderByWithRelationInput[] | undefined;

  //3. Depois, realiza a busca dos filmes no banco de dados usando o Prisma, passando a cláusula `orderBy` que acabamos de definir.
  if (sort === "title") {
    orderBy = {
      title: "asc",
    }; 
  } else if (sort === "release_date") {
    orderBy = {
      release_date: "asc",
    };
  }

  try {
    const movies = await prisma.movie.findMany({
      orderBy, include: {
        genres: true,
        language: true,
      }
    });

    res.json(movies);

  } catch (error){
    //4. Por fim, retorna a lista de filmes ao cliente. Se ocorrer um erro durante qualquer parte deste processo, retorna um erro 500 ao cliente.
    console.log(error);
    res.status(500).send({message: "Houve um problema ao buscar os filmes."});
  }
  
});

app.get("movies/language", async(req, res) => {
  const {language} = req.query;
  const languageName = language as string;

  let where = {};
  if (languageName) {
    where = {
      language: {
        name: {
          equals: languageName,
          mode: "insensitive",
        },
      },
    };
  }

  try {
    const movies = await prisma.movie.findMany({
      where: where,
      include: {
        genres: true,
        language: true,
      }
    });

    res.json(movies)
  } catch (error) {
    console.log(error);
    res.status(500).send({message: "Houve um problema ao buscar os filmes."})
  }
});

app.listen(port, () => {
  console.log(`Servidor em execução na porta ${port}`);
})