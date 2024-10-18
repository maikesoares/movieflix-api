import express from "express";
import { Prisma, PrismaClient } from "@prisma/client";
import swaggerUi from 'swagger-ui-express';
import swaggerDocument from  '../swagger.json'
import { title } from "process";
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

    const totalMovies = movies.length;
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

app.put("/genres/:id", async(req, res) => {
  const { id } = req.params;
  const { name } = req.body;

  if(!name) {
    return res.status(400).send({message: "O nome do gênero é obrigatório."})
  }

  try{
    const genre = await prisma.genre.findUnique({
      where: {id: Number(id)}
    });

    if(!genre) {
      return res.status(404).send({message: "Gênero não encontrado"})
    }

    const existingGenre = await prisma.genre.findFirst({
      where: {
        name: {equals: name, mode: "insensitive"},
        id: {not: Number(id)}
      }
    });

    if(existingGenre){
      return res.status(409).send({message: "Este nome de gênero já existe."})
    }

    const updateGenre = await prisma.genre.update({
      where: {id:Number(id)},
      data: {name}
    });

    res.status(200).json(updateGenre)
  }catch(error) {
    console.log(error);
    res.status(500).send({message: "Houve um problema ao atualizar o gênero."})
  }

});

app.post("/genres", async (req, res) => {
  const { name } = req.body;
  console.log(name);

  if(!name) {
    return res.status(400).send({message:"Por favor, informe o nome do gênero."})
  }

  try{
    const existingGenre = await prisma.genre.findFirst({
      where: {
        name: {equals: name, mode: "insensitive"},
      }
    });

    if(existingGenre){
      return res.status(409).send({message: "Este gênero já existe."})
    }

    const newGenre = await prisma.genre.create({
      data: {
        name
      }
    });

    res.status(201).json(newGenre);

  }catch(error){
    console.log(error);
    return res.status(500).send({message: "Erro ao cadastar gênero."})
  }
});

app.get("/genres", async (_, res) => {

  try {
    const genres = await prisma.genre.findMany({
      orderBy: {
        name: 'asc'
      }
    });
    
    res.json(genres)
  }catch(error){
    console.log(error);
    return res.status(500).send({message: "Erro ao listar gêneros."})
  }

});

app.delete("/genres/:id", async (req, res) => {
  const { id } = req.params;

  try{
    const genre = await prisma.genre.findUnique({
      where: {id: Number(id)}
    });

    if(!genre) {
      return res.status(404).send({message: "Gênero não encontrado."})
    }

    await prisma.genre.delete({
      where: {id: Number(id)}
    })

    res.status(200).send({message: "Gênero excluído com sucesso !"})
    }catch(error) {
      console.log(error);
      return res.status(500).send({message: "Houve um problema ao remover o gênero."})
    }
})

app.get("/movies/sort", async(req, res) => {
  const {sort} = req.query;
  console.log(sort);

  let orderBy: Prisma.MovieOrderByWithRelationInput | Prisma.MovieOrderByWithRelationInput[] | undefined;

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
    console.log(error);
    res.status(500).send({message: "Houve um problema ao buscar os filmes."});
  }
  
});

app.get("/movies/language", async(req, res) => {
  const { language } = req.query;
  const languageName = language as string;

  let where = {};
  if (languageName) {
    where = {
      languages: {
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

app.get("/movies/filter" ,async(req, res) => {
  const {language, sort} = req.query;
  const languageName = language as string;
  const sortName = sort as string;

  let orderBy = {};
  if (sortName === "title") {
    orderBy = {
      title: "asc",
    };
  }else if (sortName === "release_date") {
    orderBy = {
      release_date : 'asc',
    };
  }

  let where = {};
  if (languageName) {
    where = {
      languages: {
        name: {
          equals: languageName,
          mode: "insensitive",
        },
      },
    };
  }

  try {
    const movies = await prisma.movie.findMany({
      orderBy,
      where: where,
      include: {
        genres: true,
        language: true,
      }
    });

    res.json(movies);
  }catch(error) {
    console.log(error);
    res.status(500).send({message: "Houve um problema ao buscar os filmes."})
  }
})

app.listen(port, () => {
  console.log(`Servidor em execução na porta ${port}`);
})